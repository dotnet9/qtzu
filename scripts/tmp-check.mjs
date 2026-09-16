// 临时脚本：语法校验（用后即删）
import { execSync } from 'child_process';
let bad = 0;
for (const f of ['js/game.js', 'js/ui.js', 'js/main.js']) {
  try { execSync(`node --check --input-type=module < "${f}"`, { shell: 'cmd.exe', stdio: 'pipe' }); console.log(f, 'OK'); }
  catch (e) { console.log(f, 'FAIL', e.stderr && e.stderr.toString().slice(0, 300)); bad++; }
}
process.exit(bad);
