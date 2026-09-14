export const styles = `
:host { all: initial; color-scheme: light; }
* { box-sizing: border-box; }
.a { font: 14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#20241f; letter-spacing:0; }
button,input,textarea { font:inherit; }
button { cursor:pointer; }
button:disabled { opacity:.5; cursor:wait; }
button:focus-visible,a:focus-visible { outline:3px solid #6d891e; outline-offset:3px; }
button { border:0; background:none; color:inherit; }
.bar { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:8px; background:#20241f; color:#fff; padding:8px; border:1px solid #464b41; border-radius:40px; box-shadow:0 8px 32px #0003; white-space:nowrap; }
.brand { font-weight:750; font-size:16px; letter-spacing:-.6px; padding:0 10px; }
.bar button { padding:9px 14px; border-radius:24px; }
.bar .add,.primary { background:#dfff7f; color:#20241f; font-weight:650; }
.bar .count { background:#ffffff14; }
.panel { position:fixed; right:20px; top:20px; bottom:96px; width:370px; background:#fffefa; border:1px solid #dedfd5; border-radius:18px; box-shadow:0 16px 64px #17201526; overflow:hidden; display:flex; flex-direction:column; }
.header { padding:22px 22px 18px; border-bottom:1px solid #e8e9df; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
h2 { font:normal 27px/1.2 Georgia,serif; margin:0 0 7px; letter-spacing:-.6px; }
p { margin:0; }
.muted { color:#777d70; font-size:12px; }
.close { font-size:22px; line-height:1; padding:3px 7px; }
.scroll { overflow:auto; padding:18px; flex:1; overscroll-behavior:contain; }
.tabs { display:flex; gap:8px; padding:12px 18px; border-bottom:1px solid #e8e9df; }
.tabs button { font-size:12px; padding:5px 9px; border-radius:7px; }
.tabs [aria-pressed=true] { background:#eaf0dc; }
.card { width:100%; text-align:left; padding:16px; border:1px solid #e4e6da; border-radius:12px; background:white; margin:0 0 10px; }
.card:hover { border-color:#a6b28f; }
.meta { display:flex; align-items:center; gap:7px; font-size:11px; color:#717769; margin-bottom:10px; }
.avatar { display:inline-grid; place-items:center; width:25px; height:25px; border-radius:50%; background:#eef0e7; color:#404c32; font-weight:700; }
.note { white-space:pre-wrap; overflow-wrap:anywhere; }
.quote { margin:12px 0; padding:10px 12px; border-left:2px solid #b3ce78; background:#f4f6ec; font-size:12px; overflow-wrap:anywhere; }
.status { margin-left:auto; font-size:10px; text-transform:uppercase; letter-spacing:.8px; }
.empty { text-align:center; padding:58px 16px; color:#747a6c; }
.empty strong { display:block; color:#292e25; margin:14px 0 8px; font-weight:550; }
.empty .symbol { font:40px Georgia,serif; }
form { display:flex; flex-direction:column; gap:12px; }
label { font-size:12px; font-weight:600; display:flex; flex-direction:column; gap:6px; }
input,textarea { width:100%; background:white; color:#20241f; padding:12px; border:1px solid #d9dece; border-radius:9px; outline:none; }
input:focus,textarea:focus { border-color:#829a4f; box-shadow:0 0 0 3px #dfff7f44; }
textarea { min-height:110px; resize:vertical; }
.primary { border-radius:9px; padding:11px 16px; }
.secondary { border:1px solid #dce0d1; border-radius:9px; padding:10px 14px; }
.actions { display:flex; gap:8px; margin-top:16px; }
.error { background:#fff0ed; color:#963a2c; border:1px solid #f2d0c7; padding:11px 14px; border-radius:9px; margin:12px 18px 0; font-size:12px; }
.pin { position:fixed; width:25px; height:25px; border-radius:50% 50% 50% 0; background:#dfff7f; color:#263017; border:2px solid #fff; box-shadow:0 2px 8px #0003; font-size:11px; font-weight:700; pointer-events:auto; }
.outline { position:fixed; pointer-events:none; border:2px solid #97b546; background:#dfff7f22; border-radius:3px; }
.hint { position:fixed; bottom:96px; left:50%; transform:translateX(-50%); padding:10px 16px; background:#20241f; color:#fff; border-radius:10px; font-size:12px; text-align:center; }
.footer { padding:12px 20px; border-top:1px solid #e8e9df; font-size:11px; color:#818676; display:flex; justify-content:space-between; }
.footer button { text-decoration:underline; }
a { color:#526d27; }
.reply { border-top:1px solid #e8e9df; padding:16px 0; }
.back { margin-bottom:16px; color:#6b745d; padding:0; }
@media(max-width:600px) { .panel { right:10px; left:10px; top:10px; width:auto; bottom:92px; } .bar { bottom:16px; } .brand { padding:0 4px; } .bar button { padding:8px 10px; } }
`;
