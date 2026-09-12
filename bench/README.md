# Benchmarks

The benchmark suite measures **routing effectiveness** against an
always-largest-model baseline, so it must run with model fallback forced **off**.
With fallback on, a declared-chain substitution changes which model actually ran
and contaminates the measurement.

Use these settings for every benchmark run:

```
MODEL_FALLBACK_ENABLED=false
```

See `bench/.env.example`. The production default is `true` (declared chains
only); benchmarks override it.
