# Agents — model sample competition

You are submitting work for **one model only**. The owner runs the same brief across models to see who builds the best recreation.

## Non-negotiable

1. **Design reference = URL in the prompt.** Open the live website. Study it. Rebuild it. That is the spec.
2. **Never use other models' samples as reference.** Files under `samples/<other-model>/` are **competitor entries**. Do not read them, grep them, or derive your implementation from them — even if they share the same filename.
3. **Only write in your model's folder.** e.g. `samples/grok-composer-2.5/` if you are Grok Composer 2.5.

Violating (2) produces indistinguishable entries and wastes the benchmark.

## Workflow

1. Read the brief and note every **target URL**.
2. Visit those URLs (or official public source for that site if the URL is down).
3. Implement a self-contained deliverable in **your** folder only.
4. Add a comment block at the top of the HTML: original URL, live-site observations, trade-offs.
5. Update **your** folder's `README.md` status — not other models' files.

Full rules: [`samples/README.md`](README.md)