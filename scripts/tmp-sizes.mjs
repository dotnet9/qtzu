import { execSync } from 'child_process';
const AB = 'C:/Users/liu64/.workbuddy/binaries/node/versions/22.12.0.installing.20396.__extract_temp__/node-v22.12.0-win-x64/agent-browser.cmd';
const run = c => { try { return execSync('"' + AB + '" ' + c, { shell: 'cmd.exe', encoding: 'utf8' }).trim(); } catch (e) { return 'ERR: ' + String(e.stderr || e.message).slice(0, 150); } };
const sleep = ms => execSync('timeout /t ' + Math.ceil(ms / 1000) + ' /nobreak >nul', { shell: 'cmd.exe' });

run('close');                        // 重置会话（拿 --headed 窗口）
console.log(run('open --headed http://localhost:6100').split('\n')[0]);
sleep(9000);                         // 等世界加载（存档直接进世界）

// 三尺寸截图
for (const [w, h, name] of [['390', '844', 'm-portrait'], ['844', '390', 'm-land'], ['1280', '800', 'desktop']]) {
  console.log(name, run('resize ' + w + ' ' + h).split('\n')[0]);
  sleep(2500);
  console.log('  shot:', run('screenshot --filename=audit-' + name + '.png').split('\n').pop());
}
