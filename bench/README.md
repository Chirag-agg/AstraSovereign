# Benchmarks

The benchmark suite measures **routing effectiveness** against an
always-largest-model baseline, so it must run with model fallback forced **off**.
With fallback on, a declared-chain substitution changes which model actually ran
and contaminates the measurement.

Use these settings for every benchmark run:

```
MODEL_FALLBACK_ENABLED=false
BENCH_MODE=true
```

See `bench/.env.example`. `MODEL_FALLBACK_ENABLED` defaults to `true` in
production (declared chains only). `BENCH_MODE` forces temperature `0` and a
fixed seed on every generation call, so a run measures the system rather than
sampling noise; production keeps sampling. Both are overridden for benchmarks.
