package com.academiax.auth;

import com.academiax.auth.dto.*;
import com.academiax.auth.entity.User;
import com.academiax.auth.entity.UserRole;
import com.academiax.auth.exception.*;
import com.academiax.auth.repository.RefreshTokenRepository;
import com.academiax.auth.repository.UserRepository;
import com.academiax.auth.security.JwtService;
import com.academiax.auth.service.AuthService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.context.ActiveProfiles;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AuthServiceTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private JwtService jwtService;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @BeforeEach
    void cleanDb() {
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ─── Registration ───────────────────────────────────────────────────

    @Test
    @Order(1)
    @DisplayName("Register: succeeds and always assigns STUDENT role")
    void register_SucceedsAsStudent() {
        UserResponse response = authService.register(buildRegisterRequest());

        assertNotNull(response);
        assertEquals("teststudent@academiax.edu", response.getEmail());
        assertEquals(UserRole.STUDENT, response.getRole());
    }

    @Test
    @Order(2)
    @DisplayName("Register: duplicate email throws ConflictException")
    void register_DuplicateEmailThrowsConflict() {
        authService.register(buildRegisterRequest());
        assertThrows(ConflictException.class, () -> authService.register(buildRegisterRequest()));
    }

    @Test
    @Order(3)
    @DisplayName("Register: role field is ignored — always STUDENT")
    void register_RoleFieldIgnored() {
        RegisterRequest req = buildRegisterRequest();
        req.setRole(UserRole.ADMIN); // Attempted privilege escalation

        UserResponse response = authService.register(req);

        assertEquals(UserRole.STUDENT, response.getRole());
    }

    // ─── Login ─────────────────────────────────────────────────────────

    @Test
    @Order(4)
    @DisplayName("Login: success returns access and refresh tokens")
    void login_Success() {
        authService.register(buildRegisterRequest());

        AuthResponse response = authService.login(buildLoginRequest());

        assertNotNull(response.getAccessToken());
        assertNotNull(response.getRefreshToken());
        assertEquals("STUDENT", response.getRole());
    }

    @Test
    @Order(5)
    @DisplayName("Login: wrong password throws BadCredentialsException")
    void login_WrongPasswordThrows() {
        authService.register(buildRegisterRequest());

        AuthRequest req = new AuthRequest();
        req.setEmail("teststudent@academiax.edu");
        req.setPassword("WrongPass@1");

        assertThrows(BadCredentialsException.class, () -> authService.login(req));
    }

    @Test
    @Order(6)
    @DisplayName("Login: 5 failed attempts locks the account")
    void login_FiveFailedAttemptsLocksAccount() {
        authService.register(buildRegisterRequest());

        AuthRequest wrongReq = new AuthRequest();
        wrongReq.setEmail("teststudent@academiax.edu");
        wrongReq.setPassword("Wrong@1pass");

        // Attempts 1–4 should throw BadCredentialsException
        for (int i = 0; i < 4; i++) {
            assertThrows(BadCredentialsException.class, () -> authService.login(wrongReq),
                    "Attempt " + (i + 1) + " should throw BadCredentialsException");
        }
        // 5th attempt triggers lockout
        assertThrows(AccountLockedException.class, () -> authService.login(wrongReq),
                "5th attempt should throw AccountLockedException");
    }

    @Test
    @Order(7)
    @DisplayName("Login: locked account rejects even correct password")
    void login_LockedAccountRejectsCorrectPassword() {
        authService.register(buildRegisterRequest());

        // Lock the account manually
        User user = userRepository.findByEmail("teststudent@academiax.edu").orElseThrow();
        user.setFailedLoginAttempts(5);
        user.setLockoutUntil(LocalDateTime.now().plusMinutes(15));
        userRepository.save(user);

        assertThrows(AccountLockedException.class, () -> authService.login(buildLoginRequest()));
    }

    @Test
    @Order(8)
    @DisplayName("Login: deactivated account throws UnauthorizedException")
    void login_DeactivatedAccountThrows() {
        authService.register(buildRegisterRequest());

        User user = userRepository.findByEmail("teststudent@academiax.edu").orElseThrow();
        user.setActive(false);
        userRepository.save(user);

        assertThrows(UnauthorizedException.class, () -> authService.login(buildLoginRequest()));
    }

    // ─── Refresh Token ─────────────────────────────────────────────────

    @Test
    @Order(9)
    @DisplayName("Refresh: success returns new tokens")
    void refresh_SuccessReturnsNewTokens() {
        authService.register(buildRegisterRequest());
        AuthResponse loginResp = authService.login(buildLoginRequest());
        String oldRefresh = loginResp.getRefreshToken();

        AuthResponse refreshResp = authService.refresh(oldRefresh);

        assertNotNull(refreshResp.getAccessToken());
        assertNotNull(refreshResp.getRefreshToken());
        assertEquals("STUDENT", refreshResp.getRole());
        // Rotation must issue a different token even within the same second (regression: tokens used to collide)
        assertNotEquals(oldRefresh, refreshResp.getRefreshToken());
        assertNotNull(authService.refresh(refreshResp.getRefreshToken()).getRefreshToken());
    }

    @Test
    @Order(13)
    @DisplayName("JWT: expired token is rejected")
    void jwt_ExpiredTokenRejected() {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        String expired = Jwts.builder()
                .claim("userId", "1").claim("role", "STUDENT").claim("token_type", "ACCESS")
                .subject("someone@academiax.edu")
                .issuedAt(new Date(System.currentTimeMillis() - 120_000))
                .expiration(new Date(System.currentTimeMillis() - 60_000))
                .signWith(key)
                .compact();

        assertThrows(UnauthorizedException.class, () -> jwtService.validateToken(expired));
    }

    @Test
    @Order(14)
    @DisplayName("JWT: tampered payload (role changed to ADMIN) fails signature check")
    void jwt_TamperedTokenRejected() {
        authService.register(buildRegisterRequest());
        String token = authService.login(buildLoginRequest()).getAccessToken();
        String[] parts = token.split("\\.");
        String payload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8)
                .replace("\"STUDENT\"", "\"ADMIN\"");
        String forged = parts[0] + "." + Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8)) + "." + parts[2];

        assertThrows(UnauthorizedException.class, () -> jwtService.validateToken(forged));
    }

    @Test
    @Order(15)
    @DisplayName("Refresh: after reuse is detected, the rotated token is revoked too")
    void refresh_ReuseRevokesRotatedToken() {
        authService.register(buildRegisterRequest());
        String original = authService.login(buildLoginRequest()).getRefreshToken();
        String rotated = authService.refresh(original).getRefreshToken();

        assertThrows(UnauthorizedException.class, () -> authService.refresh(original));
        assertThrows(UnauthorizedException.class, () -> authService.refresh(rotated));
    }

    @Test
    @Order(10)
    @DisplayName("Refresh: access token rejected (token_type must be REFRESH)")
    void refresh_AccessTokenRejected() {
        authService.register(buildRegisterRequest());
        AuthResponse loginResp = authService.login(buildLoginRequest());
        String accessToken = loginResp.getAccessToken();

        assertThrows(UnauthorizedException.class, () -> authService.refresh(accessToken));
    }

    @Test
    @Order(11)
    @DisplayName("Refresh: reuse of old refresh token revokes entire family")
    void refresh_TokenReuseRevokesFamily() {
        authService.register(buildRegisterRequest());
        AuthResponse loginResp = authService.login(buildLoginRequest());
        String originalRefresh = loginResp.getRefreshToken();

        // First refresh — valid, rotates token
        authService.refresh(originalRefresh);

        // Reuse the old token — reuse attack detected → family revoked
        assertThrows(UnauthorizedException.class, () -> authService.refresh(originalRefresh));
    }

    // ─── Instructor Creation ────────────────────────────────────────────

    @Test
    @Order(12)
    @DisplayName("createInstructor: service creates INSTRUCTOR role account")
    void createInstructor_CreatesInstructor() {
        InstructorCreateRequest req = new InstructorCreateRequest();
        req.setName("Prof. Test");
        req.setEmail("instructor.test@academiax.edu");
        req.setPassword("Instr@Test1");
        req.setDepartment("Physics");

        UserResponse result = authService.createInstructor(req);

        assertEquals(UserRole.INSTRUCTOR, result.getRole());
        assertEquals("instructor.test@academiax.edu", result.getEmail());
    }

    @Test
    @Order(13)
    @DisplayName("createInstructor: duplicate instructor email throws ConflictException")
    void createInstructor_DuplicateEmailThrowsConflict() {
        InstructorCreateRequest req = new InstructorCreateRequest();
        req.setName("Prof. Dup");
        req.setEmail("dup.instructor@academiax.edu");
        req.setPassword("Instr@Dup1");
        req.setDepartment("Math");
        authService.createInstructor(req);

        InstructorCreateRequest req2 = new InstructorCreateRequest();
        req2.setName("Prof. Dup2");
        req2.setEmail("dup.instructor@academiax.edu");
        req2.setPassword("Instr@Dup1");
        req2.setDepartment("Math");
        assertThrows(ConflictException.class, () -> authService.createInstructor(req2));
    }

    // ─── Helpers ───────────────────────────────────────────────────────

    private RegisterRequest buildRegisterRequest() {
        RegisterRequest req = new RegisterRequest();
        req.setName("Test Student");
        req.setEmail("teststudent@academiax.edu");
        req.setPassword("Student@Test1");
        req.setDepartment("Computer Science");
        return req;
    }

    private AuthRequest buildLoginRequest() {
        AuthRequest req = new AuthRequest();
        req.setEmail("teststudent@academiax.edu");
        req.setPassword("Student@Test1");
        return req;
    }
}
