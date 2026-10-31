import os, re, sys, time, json, zipfile, shutil, subprocess, urllib.request

REPO = "hgg543470-bot/JennyPlayer"
OUT_DIR = "/storage/emulated/0/Download"
TMP_DIR = "/data/data/com.termux/files/usr/tmp/jenny_apk_dl"

def get_token():
    try:
        r = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    except Exception:
        pass
    cred = os.path.expanduser("~/.git-credentials")
    if os.path.exists(cred):
        with open(cred, "r", encoding="utf-8") as f:
            m = re.search(r"https://[^:]+:([^@]+)@github\.com", f.read())
            if m:
                return m.group(1).strip()
    return None

TOKEN = get_token()

def fetch_runs():
    res = subprocess.run(
        ["gh", "run", "list", "-R", REPO, "-L", "5", "--json",
         "databaseId,number,status,conclusion,headSha,displayTitle,createdAt"],
        capture_output=True, text=True
    )
    if res.returncode == 0 and res.stdout.strip():
        return json.loads(res.stdout)
    if not TOKEN:
        print("❌ Нет авторизации gh или токена.")
        sys.exit(1)
    req = urllib.request.Request(f"https://api.github.com/repos/{REPO}/actions/runs?per_page=5")
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    out = []
    for r in data.get("workflow_runs", [])[:5]:
        out.append({
            "databaseId": r["id"],
            "number": r.get("run_number"),
            "status": r["status"],
            "conclusion": r.get("conclusion"),
            "headSha": r.get("head_sha", ""),
            "displayTitle": r.get("display_title") or r.get("name", ""),
            "createdAt": r.get("created_at", "")
        })
    return out

runs = fetch_runs()
if not runs:
    print("❌ Сборок на GitHub Actions не найдено.")
    sys.exit(1)

print("\n📋 Последние 5 сборок JennyPlayer:")
for idx, r in enumerate(runs, 1):
    st = r.get("status", "")
    conc = r.get("conclusion") or ""
    icon = "✅" if conc == "success" else ("⏳" if st != "completed" else "❌")
    sha = (r.get("headSha") or "")[:7]
    num = r.get("number") or r.get("databaseId")
    title = (r.get("displayTitle") or "")[:48]
    print(f"  [{idx}] {icon} #{num} [{sha}] {title} ({conc or st})")

choice = input("\n👉 Выбери сборку (1-5, Enter = 1): ").strip()
sel_idx = (int(choice) - 1) if choice.isdigit() and 1 <= int(choice) <= len(runs) else 0
selected = runs[sel_idx]
run_id = str(selected["databaseId"])
num = selected.get("number") or run_id
sha = (selected.get("headSha") or "")[:7]

while selected.get("status") != "completed":
    print(f"🔄 Сборка #{num} [{sha}] ещё идёт ({selected.get('status')})... ждём 8 сек")
    time.sleep(8)
    for r in fetch_runs():
        if str(r["databaseId"]) == run_id:
            selected = r
            break

if selected.get("conclusion") != "success":
    print(f"❌ Сборка #{num} завершилась со статусом: {selected.get('conclusion')}")
    sys.exit(1)

print(f"⬇️ Скачиваем APK из сборки #{num} [{sha}]...")
shutil.rmtree(TMP_DIR, ignore_errors=True)
os.makedirs(TMP_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

dl = subprocess.run(["gh", "run", "download", run_id, "-R", REPO, "-n", "JennyPlayer-APK", "-D", TMP_DIR])
apk_src = os.path.join(TMP_DIR, "app-debug.apk")

if not os.path.isfile(apk_src) and TOKEN:
    # Резервное скачивание с удалением заголовка Authorization при 302 редиректе на Azure
    class StripAuthRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            new_req = super().redirect_request(req, fp, code, msg, headers, newurl)
            if new_req and "Authorization" in new_req.headers:
                del new_req.headers["Authorization"]
            if new_req and " Authorization" in new_req.unredirected_hdrs:
                del new_req.unredirected_hdrs["Authorization"]
            return new_req

    req = urllib.request.Request(f"https://api.github.com/repos/{REPO}/actions/runs/{run_id}/artifacts")
    req.add_header("Authorization", f"Bearer {TOKEN}")
    with urllib.request.urlopen(req, timeout=20) as resp:
        arts = json.loads(resp.read().decode("utf-8")).get("artifacts", [])
    if arts:
        dl_url = arts[0]["archive_download_url"]
        opener = urllib.request.build_opener(StripAuthRedirect())
        dl_req = urllib.request.Request(dl_url)
        dl_req.add_header("Authorization", f"Bearer {TOKEN}")
        zip_p = os.path.join(TMP_DIR, "art.zip")
        with opener.open(dl_req, timeout=120) as r_zip, open(zip_p, "wb") as out_f:
            shutil.copyfileobj(r_zip, out_f)
        with zipfile.ZipFile(zip_p, "r") as zf:
            zf.extractall(TMP_DIR)

if os.path.isfile(apk_src):
    final_apk = os.path.join(OUT_DIR, f"JennyPlayer_#{num}_{sha}.apk")
    shutil.copy2(apk_src, final_apk)
    shutil.copy2(apk_src, os.path.join(OUT_DIR, "app-debug.apk"))
    print(f"🎉 Успешно! Файл сохранён:\n   📂 {final_apk}\n   📂 {OUT_DIR}/app-debug.apk")
else:
    print("❌ Не удалось распаковать app-debug.apk")
