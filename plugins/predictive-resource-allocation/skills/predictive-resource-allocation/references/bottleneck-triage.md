# Bottleneck triage

Four classes. Every job is limited by one of them at any moment, and relieving the
wrong one changes nothing. Identify the class before proposing a single setting.

## The four classes

| Class | What is saturated | Signature |
| --- | --- | --- |
| **Compute-bound** | ALU / SM / CPU core throughput | Utilisation pinned near 100%, wall time scales linearly with work |
| **Memory-capacity-bound** | VRAM or system RAM footprint | Out-of-memory, or a sudden order-of-magnitude collapse when a threshold is crossed |
| **Memory-bandwidth-bound** | GB/s to and from device memory | Utilisation looks high but scales poorly with clock; large batches barely beat small ones |
| **I/O-bound** | Disk or network read/write | Low utilisation on everything, spiky progress, cold and warm runs differ a lot |

There is a fifth pattern that is not a resource at all and is the most commonly
misdiagnosed: **fixed per-unit overhead**. Scene load, BVH build, kernel compile,
licence checkout, process spawn. It looks like everything being slow, and it is
distinguished by wall time barely moving when the work per unit is halved.

## Discriminating tests

Run these in order. Two agreeing tests are enough to name the class.

### Test 1 — halve the work per unit

Halve batch size, tile size, resolution, or sample count. Time one unit before and
after.

| Result | Class | What it rules out |
| --- | --- | --- |
| Time falls by roughly half | Compute-bound | Rules out fixed overhead and I/O as dominant |
| Time falls by far more than half (3x or better) | Capacity-bound, you were spilling | Rules out compute — you were not doing the work, you were moving it |
| Time falls by a quarter or less | Fixed overhead or I/O | Rules out compute; the work was not the cost |
| Time does not change | Fixed overhead | Rules out all three resources |

This single test separates more cases than everything below it.

### Test 2 — occupancy against utilisation

Read VRAM occupancy and GPU utilisation together. Neither means anything alone.

| Occupancy | Utilisation | Reading |
| --- | --- | --- |
| High (>90%) | High (>90%) | Genuinely compute or bandwidth-bound. Healthy. |
| High (>90%) | Low or sawtoothing | Capacity pressure, host-memory fallback, or input starvation |
| Low (<50%) | High | Compute-bound with room to raise batch or tile size |
| Low | Low | I/O-bound, starved, or serialised on the CPU |

**Sawtoothing utilisation** — swinging between near zero and near 100 with a period
matching one batch or one frame — is the diagnostic signature of starvation. The
device is waiting for data, not computing slowly. No GPU purchase fixes it.

### Test 3 — cold cache against warm cache

Run the job twice without changing anything and time both.

- **Second run much faster** → the working set fits in page cache and the first run
  was I/O-bound. Fix the storage path or the data layout, not the compute.
- **Second run the same** → the data does not fit in cache, or it was never I/O. If
  utilisation is also low, you are read-bandwidth-bound and it will not improve with
  repetition.

On Linux, `sync; echo 3 > /proc/sys/vm/drop_caches` makes the cold run genuinely cold.
Without that, the "cold" run is often already warm and the test lies.

### Test 4 — scale one clock at a time

Where the tooling allows it, drop the memory clock 10% and re-time, then restore and
drop the core clock 10% and re-time. Whichever change hurts more is the binding
resource. This distinguishes compute-bound from bandwidth-bound, which Tests 1 to 3
cannot do reliably.

Rough guide: if a 10% memory clock cut costs more than 6% of throughput, the job is
bandwidth-bound.

## Symptom index

| Symptom | Most likely class | What it rules out |
| --- | --- | --- |
| Out of memory error at a specific batch or resolution | Capacity | Everything else, until it fits |
| Render fine at 1080p, unusably slow at 4K, non-linear jump | Capacity — framebuffer and tile buffers crossed the line | A linear compute story |
| GPU at 20–40%, CPU one core at 100% | Serialised CPU stage — BVH build, dataloader, single-threaded node | GPU capability |
| GPU util sawtooths 0–100 each step | Input starvation | Compute, capacity, bandwidth |
| First frame 4 minutes, later frames 20 seconds | Fixed overhead — scene load, BVH, kernel compile | A per-frame compute problem |
| Progress bar stalls at the same percentage every run | I/O or a single pathological asset | Random contention |
| Doubling batch size barely improves throughput | Bandwidth-bound, or already saturated | Compute headroom |
| Wall time 10x worse than a machine with the same GPU | Capacity spill to host memory, or network storage | Anything gradual |
| Everything is slow and nothing is above 40% | I/O, thermal throttling, or a virtualised host | Compute |

## What each class actually costs you

Rough current-generation figures, useful for order-of-magnitude reasoning only.

| Path | Bandwidth | Relative |
| --- | --- | --- |
| GPU on-card memory (HBM or GDDR7) | 700 – 1500 GB/s | 1x |
| PCIe 5.0 x16 | ~64 GB/s | ~1/20 |
| PCIe 4.0 x16 | ~32 GB/s | ~1/40 |
| DDR5 system memory, dual channel | 60 – 90 GB/s | ~1/15 |
| NVMe Gen4 SSD, sequential | 5 – 7 GB/s | ~1/150 |
| SATA SSD | ~0.55 GB/s | ~1/1500 |
| 10 GbE network storage | ~1.1 GB/s | ~1/800 |
| 1 GbE network storage | ~0.11 GB/s | ~1/8000 |
| Spinning disk, random reads | 0.001 – 0.01 GB/s | catastrophic |

This table is why the capacity cliff matters so much. Falling off the card is not a
degradation, it is a change of regime.

## Rules of thumb worth holding

- **Utilisation is not efficiency.** A kernel that is bandwidth-starved still reports
  high utilisation on most tools. Utilisation says the SMs are busy, not that they are
  doing useful arithmetic.
- **Cache your evidence, not your conclusion.** Write down the numbers from each test.
  When the first remedy fails, the numbers tell you which class you got wrong.
- **Two constraints often sit close together.** Relieve the first and the second binds
  within 20% of the old time. That is normal and is not a failed diagnosis — say up
  front what the likely second constraint is.
- **Nothing on this page is a substitute for a profiler.** Nsight Systems, `py-spy`,
  a renderer's own stats panel and Houdini's performance monitor all give the answer
  directly. Recommend them whenever the user has the patience.
