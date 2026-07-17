#!/bin/bash
# bridge-matrix.sh — scripted falsification matrix for ask-codex.mjs (v0.2.0).
# Stubs the codex CLI to exercise every classified probe outcome deterministically,
# plus critique-mode envelope shape. No network, no cost. Run from the repo root.
set -u
BRIDGE="skills/fable-super-god-mode/scripts/ask-codex.mjs"
STUB=$(mktemp -d); PASS=0; FAIL=0
declare -a RESULTS

mkstub() { cat > "$STUB/codex" << EOF
#!/bin/bash
$1
EOF
chmod +x "$STUB/codex"; }

# helper: find the -o <file> argument codex was given
OUTGRAB='out=""; prev=""; for a in "$@"; do [ "$prev" = "-o" ] && out="$a"; prev="$a"; done'

check() { # name, expected_probe, expected_exit, env_path
  local name="$1" want_probe="$2" want_exit="$3" use_path="$4"
  local out got_exit got_probe
  out=$(PATH="$use_path" node "$BRIDGE" --probe --timeout 5 2>/dev/null); got_exit=$?
  got_probe=$(printf '%s' "$out" | python3 -c "import json,sys;print(json.load(sys.stdin).get('probe','PARSE_FAIL'))" 2>/dev/null || echo PARSE_FAIL)
  if [ "$got_probe" = "$want_probe" ] && [ "$got_exit" = "$want_exit" ]; then
    PASS=$((PASS+1)); RESULTS+=("PASS  $name -> $got_probe/$got_exit")
  else
    FAIL=$((FAIL+1)); RESULTS+=("FAIL  $name -> got $got_probe/$got_exit, want $want_probe/$want_exit")
  fi
}

# 1. cli_missing: an isolated bin dir with ONLY node (the real codex often lives
# in the same npm bin dir as node, so the node dir itself cannot be on PATH)
ISOBIN=$(mktemp -d); ln -s "$(command -v node)" "$ISOBIN/node"
check "cli_missing" cli_missing 20 "$ISOBIN:/usr/bin:/bin"
rm -rf "$ISOBIN"

# 2. auth error that MENTIONS model (the Gate-1 finding-1 trap) -> auth_failure
mkstub 'echo "ERROR: invalid authentication credentials; no access token for model gpt-5.6-sol — run codex login" >&2; exit 1'
check "auth_text_with_model" auth_failure 20 "$STUB:$PATH"

# 3. positively-bound model rejection -> model_rejected/30
mkstub 'echo "ERROR: {\"type\":\"error\",\"status\":400,\"error\":{\"message\":\"The model is not supported when using Codex with a ChatGPT account.\"}}" >&2; exit 1'
check "model_rejected" model_rejected 30 "$STUB:$PATH"

# 4. network failure
mkstub 'echo "error sending request: getaddrinfo ENOTFOUND api.openai.com" >&2; exit 1'
check "network_failure" network_failure 20 "$STUB:$PATH"

# 5. timeout (stub sleeps past --timeout 5)
mkstub 'sleep 30'
check "timeout" timeout 20 "$STUB:$PATH"

# 6. malformed output (exit 0, wrong echo)
mkstub "$OUTGRAB"'
printf "hello world" > "$out"; exit 0'
check "malformed_output" malformed_output 20 "$STUB:$PATH"

# 7. probe_ok via stub (echo the exact requested line back from stdin)
mkstub "$OUTGRAB"'
line=$(grep -o "PROBE_OK [a-f0-9]*" -m1 -); printf "%s" "$line" > "$out"; exit 0'
check "probe_ok_exact" probe_ok 0 "$STUB:$PATH"

# 8. exactness rule: nonce present but wrapped in prose -> malformed_output
mkstub "$OUTGRAB"'
line=$(grep -o "PROBE_OK [a-f0-9]*" -m1 -); printf "Sure! %s — done" "$line" > "$out"; exit 0'
check "probe_prose_wrapped" malformed_output 20 "$STUB:$PATH"

# 9. critique-mode envelope backward compat via stub (valid verdict JSON)
mkstub "$OUTGRAB"'
cat - > /dev/null; printf "{\"verdict\":\"approved\",\"summary\":\"stub ok\",\"findings\":[]}" > "$out"; echo "model: stub-model" >&2; exit 0'
TMPP=$(mktemp); printf 'stub critique request\n' > "$TMPP"
ENV_OUT=$(PATH="$STUB:$PATH" node "$BRIDGE" "$TMPP" --timeout 10 2>/dev/null); C_EXIT=$?
C_OK=$(printf '%s' "$ENV_OUT" | python3 -c "
import json,sys
e=json.load(sys.stdin)
ok = e['verdict']=='approved' and e['model']==e['requested_model'] and e['reported_model']=='stub-model' and 'summary' in e and 'findings' in e
print('yes' if ok else 'no')" 2>/dev/null || echo no)
if [ "$C_OK" = "yes" ] && [ "$C_EXIT" = "0" ]; then PASS=$((PASS+1)); RESULTS+=("PASS  critique_envelope_compat -> approved/0, legacy model key + requested/reported present")
else FAIL=$((FAIL+1)); RESULTS+=("FAIL  critique_envelope_compat -> exit $C_EXIT, ok=$C_OK"); fi
rm -f "$TMPP"

rm -rf "$STUB"
printf '%s\n' "${RESULTS[@]}"
echo "MATRIX: $PASS pass, $FAIL fail"
[ "$FAIL" = "0" ]
