# soemdsp-sandbox

Local browser sandbox for `soemdsp` proof artifacts and demo-scoped interactive patching.

The sandbox now has two lanes:

- a browser-only Node Wiring MVP where Osc or Noise can be wired through Gain, Bias, and Output, validated, rendered to an audible Web Audio buffer, and inspected through local waveform and signal-plot canvases
- a read-only artifact inspector for generated `soemdsp` handoff manifests, WAVs, phase reports, producer proofs, boundary flags, parameter resync data, waveform playback, level envelopes, and X/Y signal plots

The server remains read-only. The node graph is intentionally demo-scoped browser state; it does not save patches, mutate `Circuit`, add a scheduler, or become a plugin layer.

## Run

Generate the current artifact packet from `soemdsp` first:

```powershell
C:\Users\argit\Documents\_PROGRAMMING\soemdsp\build-moved\examples\Debug\runtime_dsp_object_bound_wav_resync_demo.exe
```

Start the sandbox:

```powershell
python C:\Users\argit\Documents\_PROGRAMMING\soemdsp-sandbox\server.py
```

Open:

```text
http://127.0.0.1:8765
```

## Smoke Test

After generating the current `soemdsp` artifact packet, run:

```powershell
python C:\Users\argit\Documents\_PROGRAMMING\soemdsp-sandbox\scripts\smoke_test.py
```

The smoke test starts isolated local servers on automatic temporary ports, checks
the manifest endpoint, checks the root shell DOM contract, duplicate IDs, and
audio/waveform control attributes, checks the node graph MVP shell/source/style
contract, checks static assets, checks the waveform
seek source contract, checks producer proof flags, checks the handoff contract and boundary flags, checks handoff artifact
references, checks artifact and phase coverage, checks every manifest artifact
link for reachability, checks report documents, checks hands-on readiness source
coverage, checks parameter resync summary
values, checks primary audio artifact reachability, WAV metadata, and byte-range
audio responses, checks producer-side phase audio measurements against decoded
consumer measurements, checks decoded phase frequency and peak amplitude against the manifest resync targets, checks
negative artifact handoff contract cases for entry point, audio, WAV path,
duplicate single-role artifact, and phase-report coverage mismatches, checks
negative phase-audio measurement contract cases for missing, mismatched, and
drifting producer values, checks negative parameter-resync contract cases for
missing, unchanged, invalid, and non-upward values, checks
expected error and forbidden path responses including encoded traversal, checks
that non-read methods are rejected by the read-only server, and verifies that
readable malformed manifest shapes still preserve source details for the browser
consumer. It also verifies local responses use no-store cache headers. It prints
grouped checkpoints so failures are easier to locate, including sub-checkpoints
for shell, static assets, manifest contracts, artifact reports, audio, and
server error responses.

## Boundaries

The local server is read-only. The browser may generate temporary audio from the
demo node graph, but it does not write patch/project state.

The sandbox does not:

- instantiate DSP objects
- schedule processing
- mutate Circuit
- serialize project files
- own audio engine behavior
- own plugin behavior
