import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Play, Route } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, courseApi, enrollmentApi, errorMessage, paymentApi } from '../lib/api';
import { newId, timeAgo } from '../lib/format';
import { ErrorState, PageHeader, Skeleton } from '../components/ui';

const SERVICE_ORDER = ['api-gateway', 'auth-service', 'course-service', 'enrollment-service', 'payment-service', 'notification-service'];
const sortServices = names => [...names].sort((a, b) => {
  const ia = SERVICE_ORDER.indexOf(a.toLowerCase()); const ib = SERVICE_ORDER.indexOf(b.toLowerCase());
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});

function Section({ number, title, children, aside }) {
  return (
    <section className="border-t border-ink/80 pt-5">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl"><span className="mr-3 font-mono text-base text-accent">{number}</span>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Registry() {
  const registry = useQuery({ queryKey: ['admin', 'registry'], queryFn: async () => (await adminApi.registry()).data, refetchInterval: 3000 });
  if (registry.isLoading) return <Skeleton className="h-40" />;
  if (registry.isError) return <ErrorState error={registry.error} onRetry={registry.refetch} />;
  const services = registry.data.services;
  return (
    <>
      <p className="mb-4 font-mono text-xs text-ink-muted">{registry.data.servicesCount} services · {registry.data.totalInstances} instances · refreshed every 3 s from Eureka via the gateway's DiscoveryClient</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortServices(Object.keys(services)).map(name => (
          <div key={name} className={`card p-4 ${services[name].length > 1 ? 'border-ink/60' : ''}`}>
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-sm">{name.toLowerCase()}</p>
              <p className="font-mono text-[11px] text-ink-muted">{services[name].length} instance{services[name].length === 1 ? '' : 's'}</p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {[...services[name]].sort((a, b) => a.instanceId.localeCompare(b.instanceId)).map(i => (
                <li key={i.instanceId} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${i.status === 'UP' ? 'bg-good' : 'bg-bad'}`} aria-hidden="true" />
                    <span className="font-mono">{i.instanceId}</span>
                  </span>
                  <span className={`font-mono ${i.status === 'UP' ? 'text-good' : 'text-bad'}`}>{i.status}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

function LoadBalancer() {
  const [hits, setHits] = useState([]);
  const [running, setRunning] = useState(false);

  const fire = async () => {
    setRunning(true);
    setHits([]);
    for (let i = 0; i < 20; i++) {
      try {
        const { data } = await courseApi.whoami();
        setHits(h => [...h, { n: i + 1, instance: data.instanceId, count: data.requestCount }]);
      } catch (e) {
        setHits(h => [...h, { n: i + 1, instance: 'error', error: errorMessage(e) }]);
      }
    }
    setRunning(false);
  };

  const counts = Object.entries(hits.reduce((acc, h) => ({ ...acc, [h.instance]: (acc[h.instance] || 0) + 1 }), {}))
    .map(([instance, value]) => ({ instance, value })).sort((a, b) => a.instance.localeCompare(b.instance));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <p className="text-sm text-ink-soft">Sends 20 requests to <span className="font-mono">GET /courses/whoami</span> through the gateway. Spring Cloud LoadBalancer picks an instance per request (round-robin), and each instance answers with its own id and request counter.</p>
        <button className="btn-primary mt-4" onClick={fire} disabled={running}><Play size={15} />{running ? `Firing… ${hits.length}/20` : 'Fire 20 requests'}</button>
        {hits.length > 0 && (
          <ol className="mt-5 flex flex-wrap gap-1" aria-label="Request log">
            {hits.map(h => (
              <li key={h.n} title={h.error || `request ${h.n} → ${h.instance}`}
                className={`rounded-card border px-1.5 py-0.5 font-mono text-[10px] ${h.instance === 'error' ? 'border-bad text-bad' : h.instance === counts[0]?.instance ? 'border-ink/40' : 'border-accent/60 text-accent'}`}>
                {h.instance === 'error' ? '×' : h.instance.split('@')[1] || h.instance}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="card h-56 p-4">
        {counts.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ink-muted">Hits per instance will appear here.</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={counts} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="instance" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: 'rgb(var(--ink-soft))' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} domain={[0, 20]} tick={{ fontSize: 11, fill: 'rgb(var(--ink-muted))' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgb(var(--sunken))' }} content={({ active, payload }) => active && payload?.length ? (
                <div className="card px-3 py-2 text-xs shadow-md"><span className="font-mono">{payload[0].payload.instance}</span>: {payload[0].value} requests</div>) : null} />
              <Bar dataKey="value" fill="rgb(var(--accent))" radius={[4, 4, 0, 0]} maxBarSize={72} isAnimationActive={false}>
                <LabelList dataKey="value" position="top" style={{ fontSize: 12, fontFamily: 'IBM Plex Mono', fill: 'rgb(var(--ink))' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Trace() {
  const [trace, setTrace] = useState(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setTrace(null);
    const correlationId = newId();
    try {
      const candidates = (await courseApi.list({ availableOnly: true, sort: 'availableSeats,desc', size: 50 })).data.content;
      const open = candidates.find(c => new Date(c.enrollmentDeadline) > new Date());
      if (!open) throw new Error('No course with an open seat to trace against.');
      const hold = await enrollmentApi.hold(open.id, correlationId);
      // The decline card makes the saga run its compensation too, so the seat goes straight back: nothing to clean up.
      await paymentApi.pay({ enrollmentId: hold.data.id, cardNumber: '4000000000000002', cardHolder: 'Trace Demo', expiry: '12/30', cvv: '123' }, newId(), correlationId);
      await new Promise(r => setTimeout(r, 400));
      const { data } = await adminApi.trace(correlationId);
      setTrace({ ...data, course: open.code });
    } catch (e) {
      toast.error(e.response ? errorMessage(e) : e.message);
    } finally {
      setRunning(false);
    }
  };

  const hops = trace?.hops || [];
  const t0 = hops.length ? Math.min(...hops.map(h => h.startedAt)) : 0;
  const t1 = hops.length ? Math.max(...hops.map(h => h.startedAt + h.durationMs)) : 1;
  const span = Math.max(1, t1 - t0);

  return (
    <div>
      <p className="max-w-3xl text-sm text-ink-soft">
        Holds a seat and pays with the decline card under one <span className="font-mono">X-Correlation-Id</span>. Every service records the hop, Feign forwards the id, and the gateway
        gathers the hops from all instances: gateway → enrollment → course → notification, then gateway → payment → enrollment → course (seat released) → notification.
      </p>
      <button className="btn-primary mt-4" onClick={run} disabled={running}><Route size={15} />{running ? 'Tracing…' : 'Trace one enrollment'}</button>
      {trace && (
        <div className="card mt-5 overflow-x-auto p-4">
          <p className="mb-3 font-mono text-[11px] text-ink-muted">X-Correlation-Id {trace.correlationId} · course {trace.course} · {hops.length} hops · {span} ms end to end</p>
          <ol className="min-w-[640px] space-y-1.5">
            {hops.map((h, i) => (
              <li key={i} className="grid grid-cols-[200px_1fr_56px] items-center gap-3 text-xs">
                <div className="truncate">
                  <span className={`font-mono ${h.service === 'api-gateway' ? 'text-ink' : 'text-accent'}`}>{h.instanceId}</span>
                  <span className="block truncate font-mono text-[10px] text-ink-muted">{h.method} {h.path}</span>
                </div>
                <div className="relative h-4 bg-sunken" aria-hidden="true">
                  <span className={`absolute top-0 h-full ${h.status >= 400 ? 'bg-bad/70' : h.service === 'api-gateway' ? 'bg-ink/40' : 'bg-accent'}`}
                    style={{ left: `${((h.startedAt - t0) / span) * 100}%`, width: `${Math.max(0.8, (h.durationMs / span) * 100)}%` }} />
                </div>
                <span className="text-right font-mono tabular-nums">{h.durationMs} ms</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function CircuitBreakers() {
  const cbs = useQuery({ queryKey: ['admin', 'cb'], queryFn: async () => (await adminApi.circuitBreakers()).data, refetchInterval: 5000 });
  if (cbs.isLoading) return <Skeleton className="h-24" />;
  if (cbs.isError) return <ErrorState error={cbs.error} onRetry={cbs.refetch} />;
  const rows = cbs.data.flatMap(i => Object.entries(i.circuitBreakers || {}).map(([name, cb]) => ({ instance: i.instanceId, name, ...cb })));
  if (!rows.length) return <p className="text-sm text-ink-muted">No instance reports circuit breakers yet.</p>;
  const tone = s => (s === 'CLOSED' ? 'text-good' : s === 'OPEN' ? 'text-bad' : 'text-warn');
  return (
    <div className="overflow-x-auto">
      <table className="table-ledger min-w-[600px]">
        <thead><tr><th>Instance</th><th>Breaker (Feign client)</th><th>State</th><th className="text-right">Failure rate</th><th className="text-right">Calls buffered</th><th className="text-right">Rejected</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.instance + r.name}>
              <td className="font-mono text-xs">{r.instance}</td>
              <td className="font-mono text-xs">{r.name}</td>
              <td className={`font-mono text-xs ${tone(r.state)}`}>{r.state}</td>
              <td className="text-right font-mono text-xs">{r.failureRate === '-1.0%' ? '—' : r.failureRate}</td>
              <td className="text-right font-mono text-xs">{r.bufferedCalls}</td>
              <td className="text-right font-mono text-xs">{r.notPermittedCalls}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SystemConsolePage() {
  const [opened] = useState(() => new Date());
  return (
    <div className="space-y-12">
      <PageHeader eyebrow="Administration · live" title="System console" actions={<span className="flex items-center gap-2 font-mono text-xs text-ink-muted"><Activity size={14} className="text-good" />opened {timeAgo(opened)}</span>}>
        Proof that the microservices are real: the service registry, load balancing across instances, a traced request, and circuit breakers. Kill an instance while this page is open and watch it drop out.
      </PageHeader>
      <Section number="01" title="Service registry"><Registry /></Section>
      <Section number="02" title="Load balancing"><LoadBalancer /></Section>
      <Section number="03" title="Request trace"><Trace /></Section>
      <Section number="04" title="Circuit breakers"><CircuitBreakers /></Section>
    </div>
  );
}
