# 다바르 dabar

> 말씀, 그리고 일어난 일. 오늘 있었던 일을 쓰면, 성경이 그 하루에 답합니다.

히브리어 **다바르(דָּבָר)** 는 '말씀'과 '사건'을 동시에 뜻합니다. 다바르는 일상의 기록을 성경 구절과 연결해, 자신만의 신앙 통찰을 쌓아가는 기록 도구입니다. 100% 클라이언트 사이드로 동작하며, 기록은 기기 밖으로 나가지 않습니다.

**바로 쓰기 (웹)** → https://orialthq.github.io/dabar/

## 네 가지 동사
- **읽다** — 개역한글 성경 리더 (66권 31,102절, 원문 무변형)
- **찾다** — 키워드로 성경 전권 검색
- **묻다** — 일상과 신앙의 물음에 관련 말씀을 찾아 그 안에서 함께 생각하는 대화 (기기 내 AI, WebGPU)
- **새기다** — 일상 기록에 그 하루에 닿는 말씀을 붙이는 신앙 저널 (AI 말씀 추천 + 묵상 질문)

## 데스크톱 앱 설치

[Releases](https://github.com/orialthq/dabar/releases/latest)에서 내려받거나, 터미널 한 번으로 설치할 수 있습니다. 앱은 무서명이라 처음 실행 시 OS 경고가 뜰 수 있는데, 아래 명령은 그 해제까지 포함합니다.

### macOS (Apple Silicon)

```bash
url=$(curl -fsSL https://api.github.com/repos/orialthq/dabar/releases/latest | grep -o 'https://[^"]*-mac-arm64\.dmg' | head -n 1) \
  && curl -fL "$url" -o /tmp/dabar.dmg \
  && hdiutil attach /tmp/dabar.dmg -nobrowse -quiet -mountpoint /Volumes/Dabar \
  && cp -R /Volumes/Dabar/Dabar.app /Applications/ \
  && hdiutil detach /Volumes/Dabar -quiet \
  && rm /tmp/dabar.dmg \
  && xattr -dr com.apple.quarantine /Applications/Dabar.app \
  && open /Applications/Dabar.app
```

Intel Mac은 위 명령에서 `mac-arm64`를 `mac-x64`로 바꾸면 됩니다. 설치 파일(/tmp/dabar.dmg)은 설치 후 자동 삭제됩니다.

### Windows (PowerShell)

```powershell
$u = ((Invoke-RestMethod https://api.github.com/repos/orialthq/dabar/releases/latest).assets |
  Where-Object name -like '*-win-x64.exe' | Select-Object -First 1).browser_download_url
Invoke-WebRequest $u -OutFile "$env:TEMP\dabar-setup.exe"
Start-Process "$env:TEMP\dabar-setup.exe" -Wait
Remove-Item "$env:TEMP\dabar-setup.exe"
```

설치 프로그램은 실행 후 자동 삭제됩니다. SmartScreen 경고가 뜨면 "추가 정보 → 실행"을 누르세요.

## 개발

```bash
npm install
npm run dev            # 로컬 개발 서버
npm run build          # 웹 빌드 (GitHub Pages)
npm run desktop        # 데스크톱 빌드 + Electron 실행
npm run dist:mac       # macOS 패키징 (dmg는 CI 권장)
```

- `main` push → GitHub Pages 자동 배포
- `v*` 태그 push → macOS·Windows 앱 빌드 → GitHub Releases 자동 업로드
- AI 아키텍처(하이브리드 말씀 추천, 역전 RAG)는 [SPEC-M5.md](SPEC-M5.md), 데이터 파이프라인은 [scripts/DATA.md](scripts/DATA.md) 참고

## 성경 본문에 대하여

본문은 저작재산권 보호기간이 만료된 **성경전서 개역한글판**(대한성서공회 역, 1961)을 사용하며, 원문을 변형 없이 그대로 표시합니다. "세째", "한곳" 등은 오타가 아니라 1961년 원문 표기입니다.

---
© OriAlt (오리알트)
