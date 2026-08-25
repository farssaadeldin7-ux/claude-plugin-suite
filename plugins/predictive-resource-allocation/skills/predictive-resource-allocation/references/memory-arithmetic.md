# Memory arithmetic

Capacity is checked first because it is a cliff. These formulas are deliberately coarse
— they answer "does this fit, with margin", not "how many megabytes". Treat every result
as plus or minus 20%.

Reserve **10–15%** of nominal VRAM before counting anything: driver and display reserve
(0.5–1.5 GB on a card also driving a monitor), allocator fragmentation under a long job,
and framework scratch no formula captures. A 24 GB card gives about **21 GB of usable
budget** — plan against that, not against 24.

## GPU rendering

`VRAM = geometry + BVH + textures + framebuffer + engine overhead`

### Geometry

Triangles cost roughly **50–100 bytes each** once positions, normals, UVs and indices
are on the card; use 64 as a working figure, so `geometry_GB = triangles x 64 / 1e9`.

Instances are close to free — one master mesh plus a transform per copy, so a city of
5,000 instanced buildings costs one building. Say this whenever geometry is the problem;
converting copies to instances is often the whole fix.

Displacement and subdivision are evaluated at render time and are the classic hidden
cost: subdivision level 3 is 4^3 = 64x the base triangle count.

### BVH

Budget the BVH at **1.3–2.0x the raw geometry payload**. It is rebuilt on scene change;
on CPU that build is a partly serial stage showing up as a long first frame, and on
OptiX it is fast but still allocates.

### Textures

`texture_GB = sum of ( width x height x channels x bytes_per_channel x 1.33 )`, where
the 1.33 factor is the mip chain.

| Texture | Uncompressed VRAM with mips |
| --- | --- |
| 2K, 8-bit, RGB | ~17 MB |
| 4K, 8-bit, RGB | ~67 MB |
| 4K, 16-bit half, RGBA | ~180 MB |
| 8K, 16-bit half, RGBA | ~715 MB |

Thirty 8K half-float sets will not fit on any consumer card, and this is the most common
cause of a scene that "should" fit and does not.

### Framebuffer and AOVs

`framebuffer_GB = width x height x AOV_count x 16 bytes x 2 / 1e9`, where 16 bytes is
RGBA at fp32 accumulation and the factor of 2 covers the sample buffer and denoiser input. A 4K frame
with 12 AOVs is about **3.2 GB** — often the difference between fitting and not.

### Worked example: 24 GB card

18M triangles at 64 bytes is 1.15 GB; BVH at 1.6x adds 1.84 GB; 22 texture sets, mostly
4K 8-bit with four at 8K half, come to 4.1 GB; a 4K framebuffer with 8 AOVs is 2.1 GB;
renderer and driver overhead 1.5 GB. **Total ~10.7 GB**, comfortable inside a 21 GB budget.

Raise the four 8K half sets to twelve and textures reach roughly 9.8 GB, total ~16.4 GB
— still fits, but thin enough that adding volumetrics pushes it over.

## Training

`VRAM = static_state + activations + framework overhead`

### Static state: the 16-bytes-per-parameter rule

Mixed precision with Adam, per parameter:

| Component | Bytes |
| --- | --- |
| fp16 / bf16 weight | 2 |
| fp16 / bf16 gradient | 2 |
| fp32 master weight | 4 |
| Adam first moment (fp32) | 4 |
| Adam second moment (fp32) | 4 |
| **Total** | **16** |

Variants, as `static_GB = parameters x bytes_per_parameter / 1e9`:

| Configuration | Bytes per parameter |
| --- | --- |
| Full fp32 or mixed precision, Adam | 16 |
| Mixed precision, SGD with momentum, or 8-bit Adam | 10 |
| LoRA, base frozen | 2 for the base, 16 per trainable adapter parameter |
| Inference only, fp16 | 2 |

| Model | Mixed precision + Adam | Inference fp16 |
| --- | --- | --- |
| 1.3B | 20.8 GB | 2.6 GB |
| 7B | 112 GB | 14 GB |
| 70B | 1120 GB | 140 GB |

The 7B row is the one to quote. It is why full fine-tuning a 7B model does not happen
on a single 80 GB card, why LoRA exists, and why the answer to "can I train this on my
4090" is usually no while "can I LoRA it" is usually yes.

### Activations

For a transformer in fp16:
`activations_GB ≈ layers x batch x seq_len x hidden x 34 bytes / 1e9`.

Attention adds a term scaling with seq_len squared unless a fused kernel is in use. With
FlashAttention-style kernels that term largely disappears, which is why kernel choice
matters more than almost any other setting at long context.

Activations are **linear in batch size**, which makes them the cheapest term to trade:

| Lever | Memory effect | Time cost |
| --- | --- | --- |
| Halve batch size | Halves activations | Throughput drops unless you accumulate |
| Gradient accumulation | Keeps effective batch at a smaller footprint | Near zero |
| Activation checkpointing | Cuts activations by roughly 60–80% | Adds ~30% step time |
| Shorter sequence length | Linear, or quadratic without fused attention | Changes what the model learns |
| bf16 from fp32 | Halves activations | Usually faster too |

Gradient accumulation, then activation checkpointing, then batch reduction — cheapest
first.

### Worked example: 1.3B on a 24 GB card

Static state under mixed precision with Adam is 20.8 GB against a usable budget of
about 21 GB, which leaves nothing at all for activations at any batch size.

Verdict: it does not fit, and no batch size fixes it, because the static state alone
consumes the card. This is the cliff. The remedies are all algorithmic — 8-bit Adam
takes static state to 13 GB and leaves 8 GB for activations; LoRA takes it to about
2.6 GB plus adapters; ZeRO stage 2 or 3 shards it across devices. Telling this user to
lower the batch size is the wrong answer and would waste their afternoon.

## System RAM

Host RAM matters in three places people forget:

- **Sim caches** stream through RAM before disk. A FLIP sim at 40M particles with
  velocity, ID and age is roughly 2.5 GB per frame in memory.
- **Comp** holds a frame plus every upstream cached node. Nuke on a 4K 15-layer EXR
  holds 1.5–2 GB per cached node.
- **After Effects RAM preview** stores decoded frames at `width x height x 4 bytes` for
  8-bit, doubled for 16-bit. 4K 8-bit is 33 MB per frame, so 10 seconds at 24 fps is
  about **8 GB**, before the composition's own working memory.

A safe host rule for GPU work: **system RAM at least 2x total VRAM**, more if the
renderer supports out-of-core texture paging, because that paging lands in host RAM.
