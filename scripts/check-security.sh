#!/usr/bin/env bash
# Pattern checks for the rules in security.md. Exit 1 when something is found.
fail=0
CLIENT="www lib app src"
SERVER="supabase/functions server api functions"

scan() {  # label, regex, dirs...
  local label="$1" re="$2"; shift 2
  local out
  out=$(grep -rnEi --include='*.js' --include='*.mjs' --include='*.ts' --include='*.html' \
        --include='*.json' --include='*.dart' --include='*.kt' --include='*.py' -e "$re" "$@" 2>/dev/null \
        | grep -v -e 'www/vendor/' -e 'node_modules/' -e 'security-ok' -e 'sb_publishable_' -e 'http://www.w3.org/' || true)
  if [ -n "$out" ]; then echo "== $label"; echo "$out"; fail=1; fi
}

scan "code from strings (rule 7)" 'eval\(|new Function\(|document\.write\(|setTimeout\(["`]' $CLIENT $SERVER
scan "html from text (rule 8)" '\.innerHTML *\+?=|\.outerHTML *=|insertAdjacentHTML|dangerouslySetInnerHTML' $CLIENT
scan "server key in client (rule 2)" 'service_role|sb_secret_' $CLIENT
scan "hard-coded secret (rule 2)" '(api[_-]?key|secret|passw(or)?d|token)["'"'"']? *[:=] *["'"'"'][A-Za-z0-9_./+-]{16,}["'"'"']' $CLIENT $SERVER
scan "cleartext (rule 9)" 'cleartext"? *: *true|allowMixedContent"? *: *true|"http://[^"]*"|'"'"'http://[^'"'"']*'"'" $CLIENT capacitor.config.json
scan "shell or process calls (rule 7)" 'child_process|execSync|spawnSync|\bexec\(|Deno\.run|Deno\.Command|subprocess|os\.system' $SERVER
scan "SQL joined from strings (rule 6)" '(select|insert into|update|delete from)[^;`"'"'"']*(["'"'"']+ *\+|\$\{)' $SERVER

# Tables must have RLS and at least one policy; no open policies.
SQL=$(find . -name '*.sql' -not -path './node_modules/*' 2>/dev/null)
if [ -n "$SQL" ]; then
  ALL=$(cat $SQL | tr '\n' ' ')
  for t in $(echo "$ALL" | grep -oEi 'create table( if not exists)? +(public\.)?"?[a-z_0-9]+' | sed -E 's/.* +(public\.)?"?([a-z_0-9]+)$/\2/'); do
    echo "$ALL" | grep -qEi "alter table +(public\.)?\"?$t\"? +enable row level security" || { echo "== table $t has no RLS (rule 4)"; fail=1; }
    echo "$ALL" | grep -qEi "create policy[^;]* on +(public\.)?\"?$t\"?" || { echo "== table $t has no policy (rule 4)"; fail=1; }
  done
  echo "$ALL" | grep -qEi '(using|with check) *\( *true *\)' && { echo "== open policy using (true) (rule 4)"; fail=1; }
  echo "$ALL" | grep -qEi 'security definer' && { echo "== security definer function: needs manual review"; fail=1; }
fi

[ "$fail" = 0 ] && echo "check-security: nothing found"
exit $fail
