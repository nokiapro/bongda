
import { LEAGUES } from '../data/leagues.js';
import { VLEAGUE_CLUBS } from '../data/vleague.js';
import { WORLD_CLUBS } from '../data/world.js';
import { NATIONAL_TEAMS } from '../data/national.js';
import {
  initAuth, login, logout, getCurrentUser, isAdmin,
  updateUserProfile, saveGameCloud, loadGameCloud,
  saveCustomClub, adminGetSettings
} from './auth.js';

export function getClubsForLeague(leagueId) {
    if (leagueId === 'vleague1') return VLEAGUE_CLUBS;
    if (leagueId === 'national') return NATIONAL_TEAMS;
    return WORLD_CLUBS[leagueId] || [];
}

// Make available on window for inline onclick handlers
window.getClubsForLeague = getClubsForLeague;


        // ==================== AUDIO ====================
        const AudioFX = {
            ctx: null,
            init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
            whistle() {
                this.init(); if (!this.ctx) return;
                const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
                osc.type = 'sine'; osc.frequency.setValueAtTime(2500, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(3000, this.ctx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
                osc.connect(gain); gain.connect(this.ctx.destination); osc.start(); osc.stop(this.ctx.currentTime + 0.3);
            },
            goalCheer() {
                this.init(); if (!this.ctx) return;
                const bufferSize = this.ctx.sampleRate * 1.5;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
                const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 3;
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.3);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);
                noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination); noise.start();
            },
            click() {
                this.init(); if (!this.ctx) return;
                const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
                osc.type = 'triangle'; osc.frequency.setValueAtTime(600, this.ctx.currentTime);
                gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
                osc.connect(gain); gain.connect(this.ctx.destination); osc.start(); osc.stop(this.ctx.currentTime + 0.05);
            }
        };

        // ==================== REAL LEAGUE & CLUB DATA ====================
        // Dữ liệu dựa trên V.League 1 2025/26 - 2026/27 (nguồn công khai)
// CLB V.League 1 thật + cầu thủ chủ chốt thật
// ==================== WORLD LEAGUES CLUBS (curated stars) ====================
        // Dữ liệu cầu thủ tham khảo FIFA / FO4 (fifaaddict) + thực tế 2025-26
        // OVR đã scale cho game manager (70-94), không dùng OVR FO4 thổi phồng
function getClubsForLeague(leagueId) {
            if (leagueId === 'vleague1') return VLEAGUE_CLUBS;
            return WORLD_CLUBS[leagueId] || [];
        }


        // Name pools for filling squad
        const FIRST_NAMES = ["Tuấn","Minh","Hoàng","Quang","Đức","Văn","Hùng","Sơn","Hải","Anh","Long","Thành","Công","Dũng","Nam","Khánh","Bảo","Phúc","Khang","Đạt"];
        const LAST_NAMES = ["Nguyễn","Trần","Lê","Phạm","Hoàng","Huỳnh","Vũ","Đặng","Bùi","Đỗ","Hồ","Ngô","Đinh","Lý","Tô"];

        function getRandomName() {
            return `${LAST_NAMES[Math.floor(Math.random()*LAST_NAMES.length)]} ${FIRST_NAMES[Math.floor(Math.random()*FIRST_NAMES.length)]}`;
        }

        // ==================== GAME STATE ====================
        let gameState = {
            managerName: "Nguyễn Văn A",
            clubName: "",
            clubId: "",
            clubBadge: "FC",
            leagueId: "vleague1",
            budget: 25000000,
            morale: 85,
            boardConfidence: 75,
            managerRep: 60,
            seasonYear: 2026,
            currentMatchDay: 1,
            totalMatchDays: 26,
            formation: "4-3-3",
            tacticStyle: "Tấn Công Đột Phá",
            penaltyTakerId: null,
            squad: [],
            transferMarket: [],
            youthAcademy: [],
            opponents: [],
            standings: [],
            recentResults: [],
            facilities: {
                stadium: { name: "Sân nhà", level: 1, capacity: 20000, upgradeCost: 5000000, ticketPrice: 18 },
                training: { name: "Trung Tâm Huấn Luyện", level: 1, xpBonus: 1.0, upgradeCost: 3000000 },
                academy: { name: "Học Viện Đào Tạo Trẻ", level: 1, wonderkidChance: 0.2, upgradeCost: 4000000 },
                medical: { name: "Trung Tâm Y Tế", level: 1, injuryReduce: 0.1, upgradeCost: 2500000 }
            },
            sponsor: { name: "VietCorp Telecommunications", payPerMatch: 450000 },
            // NEW FEATURES
            boardObjective: 'TOP_HALF', // TOP_3 | TOP_HALF | AVOID_RELEGATION | TITLE
            losingStreak: 0,
            winningStreak: 0,
            achievements: [],
            seasonStats: { goals: 0, cleanSheets: 0, biggestWin: 0 },
            weather: 'Nắng',
            subsUsedThisMatch: 0,
            maxSubs: 3
        };

        const PERSONALITIES = ['Tham vọng', 'Trung thành', 'Chuyên nghiệp', 'Nổi loạn', 'Lãnh đạo', 'Khiêm tốn'];
        const ACHIEVEMENT_DEFS = [
            { id: 'first_win', name: 'Chiến thắng đầu tiên', desc: 'Thắng 1 trận' },
            { id: 'win_streak_3', name: 'Phong độ cao', desc: 'Thắng 3 trận liên tiếp' },
            { id: 'win_streak_5', name: 'Bất khả chiến bại', desc: 'Thắng 5 trận liên tiếp' },
            { id: 'score_10', name: 'Vua công phá', desc: 'Ghi 10 bàn trong 1 mùa' },
            { id: 'clean_sheet_5', name: 'Bức tường thép', desc: '5 trận giữ sạch lưới' },
            { id: 'wonderkid', name: 'Săn thần đồng', desc: 'Phát hiện 1 wonderkid (POT 85+)' },
            { id: 'title', name: 'Nhà vô địch', desc: 'Vô địch giải đấu' },
            { id: 'top3', name: 'Top 3', desc: 'Kết thúc mùa trong Top 3' },
            { id: 'big_win', name: 'Hủy diệt', desc: 'Thắng cách biệt 4 bàn trở lên' },
            { id: 'survive', name: 'Sinh tồn', desc: 'Trụ hạng thành công' }
        ];

        let selectedLeagueId = null;
        let selectedClubId = null;

        // ==================== SQUAD GENERATION ====================
        function generateSquadForClub(club) {
            const positions = [
                { pos: 'GK', count: 2 }, { pos: 'CB', count: 4 }, { pos: 'LB', count: 2 }, { pos: 'RB', count: 2 },
                { pos: 'CM', count: 4 }, { pos: 'CAM', count: 2 }, { pos: 'CDM', count: 1 },
                { pos: 'RW', count: 2 }, { pos: 'LW', count: 2 }, { pos: 'ST', count: 3 }
            ];
            let squad = [];
            let idCounter = 100;
            const usedNames = new Set();
            const baseOvr = club.ovr || 70;

            // Add key real players first
            (club.keyPlayers || []).forEach(kp => {
                usedNames.add(kp.name);
                squad.push({
                    id: idCounter++,
                    name: kp.name,
                    pos: kp.pos,
                    rating: kp.rating,
                    age: kp.age,
                    birthYear: kp.birthYear || (2026 - kp.age),
                    nationality: kp.nation || kp.nationality || 'Unknown',
                    nation: kp.nation || kp.nationality || 'Unknown',
                    image: kp.image || null,
                    soccerwikiId: kp.soccerwikiId || kp.pid || null,
                    wage: kp.rating * 1400,
                    value: kp.rating * 180000,
                    isStarting: false,
                    stamina: 100,
                    goals: 0, assists: 0, yellowCards: 0,
                    isReal: true,
                    personality: PERSONALITIES[Math.floor(Math.random()*PERSONALITIES.length)],
                    form: [],
                    injuryWeeks: 0,
                    happiness: 75 + Math.floor(Math.random()*20),
                    contractYears: 1 + Math.floor(Math.random()*3),
                    potential: Math.min(94, kp.rating + Math.floor(Math.random()*8) + 2)
                });
            });

            // Fill remaining slots with generated players around club OVR
            positions.forEach(item => {
                const existing = squad.filter(p => p.pos === item.pos).length;
                for (let i = existing; i < item.count; i++) {
                    let name;
                    do { name = getRandomName(); } while (usedNames.has(name));
                    usedNames.add(name);
                    const isStarterLevel = i === 0;
                    const rating = isStarterLevel
                        ? Math.min(84, baseOvr + Math.floor(Math.random() * 5) - 1)
                        : Math.max(58, baseOvr - 8 + Math.floor(Math.random() * 8));
                    const age = Math.floor(Math.random() * 12) + 18;
                    squad.push({
                        id: idCounter++,
                        name: name,
                        pos: item.pos,
                        rating: rating,
                        age: age,
                        wage: rating * 1100,
                        value: rating * 140000,
                        isStarting: false,
                        stamina: 100,
                        goals: 0, assists: 0, yellowCards: 0,
                        isReal: false,
                        personality: PERSONALITIES[Math.floor(Math.random()*PERSONALITIES.length)],
                        form: [],
                        injuryWeeks: 0,
                        happiness: 70 + Math.floor(Math.random()*25),
                        contractYears: 1 + Math.floor(Math.random()*3),
                        potential: Math.min(92, rating + (age < 23 ? Math.floor(Math.random()*15)+5 : Math.floor(Math.random()*6)))
                    });
                }
            });

            autoPickStartingXI(squad, "4-3-3");
            return squad;
        }

        function autoPickStartingXI(squadArray, formation) {
            squadArray.forEach(p => p.isStarting = false);
            const neededPos = getFormationPositions(formation);
            let available = [...squadArray];
            neededPos.forEach(slot => {
                available.sort((a,b) => b.rating - a.rating);
                let matchIndex = available.findIndex(p => p.pos === slot.pos);
                if (matchIndex === -1) matchIndex = available.findIndex(p => p.pos !== 'GK' || slot.pos === 'GK');
                if (matchIndex === -1) matchIndex = 0;
                if (available[matchIndex]) {
                    const chosen = squadArray.find(p => p.id === available[matchIndex].id);
                    if (chosen) chosen.isStarting = true;
                    available.splice(matchIndex, 1);
                }
            });
        }

        function getFormationPositions(formation) {
            const maps = {
                "4-3-3": [
                    { pos: 'GK', top: '88%', left: '50%' },
                    { pos: 'LB', top: '68%', left: '15%' }, { pos: 'CB', top: '72%', left: '38%' },
                    { pos: 'CB', top: '72%', left: '62%' }, { pos: 'RB', top: '68%', left: '85%' },
                    { pos: 'CM', top: '48%', left: '30%' }, { pos: 'CM', top: '48%', left: '50%' },
                    { pos: 'CM', top: '48%', left: '70%' },
                    { pos: 'LW', top: '22%', left: '20%' }, { pos: 'ST', top: '18%', left: '50%' },
                    { pos: 'RW', top: '22%', left: '80%' }
                ],
                "4-4-2": [
                    { pos: 'GK', top: '88%', left: '50%' },
                    { pos: 'LB', top: '68%', left: '15%' }, { pos: 'CB', top: '72%', left: '38%' },
                    { pos: 'CB', top: '72%', left: '62%' }, { pos: 'RB', top: '68%', left: '85%' },
                    { pos: 'LM', top: '46%', left: '18%' }, { pos: 'CM', top: '48%', left: '40%' },
                    { pos: 'CM', top: '48%', left: '60%' }, { pos: 'RM', top: '46%', left: '82%' },
                    { pos: 'ST', top: '20%', left: '38%' }, { pos: 'ST', top: '20%', left: '62%' }
                ],
                "4-2-3-1": [
                    { pos: 'GK', top: '88%', left: '50%' },
                    { pos: 'LB', top: '68%', left: '15%' }, { pos: 'CB', top: '72%', left: '38%' },
                    { pos: 'CB', top: '72%', left: '62%' }, { pos: 'RB', top: '68%', left: '85%' },
                    { pos: 'CDM', top: '55%', left: '38%' }, { pos: 'CDM', top: '55%', left: '62%' },
                    { pos: 'LW', top: '32%', left: '18%' }, { pos: 'CAM', top: '30%', left: '50%' },
                    { pos: 'RW', top: '32%', left: '82%' }, { pos: 'ST', top: '15%', left: '50%' }
                ],
                "3-5-2": [
                    { pos: 'GK', top: '88%', left: '50%' },
                    { pos: 'CB', top: '72%', left: '25%' }, { pos: 'CB', top: '75%', left: '50%' },
                    { pos: 'CB', top: '72%', left: '75%' },
                    { pos: 'LM', top: '48%', left: '12%' }, { pos: 'CM', top: '50%', left: '35%' },
                    { pos: 'CM', top: '50%', left: '65%' }, { pos: 'RM', top: '48%', left: '88%' },
                    { pos: 'CAM', top: '35%', left: '50%' },
                    { pos: 'ST', top: '18%', left: '38%' }, { pos: 'ST', top: '18%', left: '62%' }
                ],
                "5-3-2": [
                    { pos: 'GK', top: '88%', left: '50%' },
                    { pos: 'LB', top: '70%', left: '10%' }, { pos: 'CB', top: '75%', left: '30%' },
                    { pos: 'CB', top: '78%', left: '50%' }, { pos: 'CB', top: '75%', left: '70%' },
                    { pos: 'RB', top: '70%', left: '90%' },
                    { pos: 'CM', top: '50%', left: '30%' }, { pos: 'CM', top: '48%', left: '50%' },
                    { pos: 'CM', top: '50%', left: '70%' },
                    { pos: 'ST', top: '20%', left: '38%' }, { pos: 'ST', top: '20%', left: '62%' }
                ]
            };
            return maps[formation] || maps["4-3-3"];
        }

        function generateTransferMarket() {
            let market = [];
            // Cầu thủ thật / nổi bật từ dữ liệu FO4 (fifaaddict) + V.League free agents
            const stars = [
                { name: 'Nguyễn Công Phượng', pos: 'ST', rating: 76, age: 31 },
                { name: 'Phan Văn Đức', pos: 'LW', rating: 75, age: 30 },
                { name: 'Hà Đức Chinh', pos: 'ST', rating: 73, age: 29 },
                { name: 'Trần Minh Vương', pos: 'CM', rating: 74, age: 30 },
                { name: 'Bùi Tiến Dũng', pos: 'CB', rating: 74, age: 28 },
                { name: 'Lương Xuân Trường', pos: 'CM', rating: 74, age: 31 },
                { name: 'Nguyễn Tuấn Anh', pos: 'CM', rating: 75, age: 31 },
                { name: 'Vũ Văn Thanh', pos: 'RB', rating: 74, age: 30 },
                { name: 'Hồ Tấn Tài', pos: 'RB', rating: 74, age: 28 },
                { name: 'Lê Viktor', pos: 'LW', rating: 73, age: 23 },
                { name: 'Nguyễn Văn Toàn', pos: 'RW', rating: 75, age: 30 },
                { name: 'Phạm Tuấn Hải', pos: 'ST', rating: 76, age: 27 },
                { name: 'Đỗ Hùng Dũng', pos: 'CM', rating: 75, age: 32 },
                { name: 'Quế Ngọc Hải', pos: 'CB', rating: 74, age: 33 },
                { name: 'Nguyễn Trọng Hoàng', pos: 'RB', rating: 72, age: 35 },
                { name: 'Lê Công Vinh', pos: 'ST', rating: 72, age: 40 }, // legend card style
                { name: 'Nguyễn Hồng Sơn', pos: 'CAM', rating: 71, age: 55 }  // legend
            ];
            stars.forEach((s, i) => {
                market.push({
                    id: 500 + i, name: s.name, pos: s.pos, rating: s.rating, age: s.age,
                    value: s.rating * 200000, wage: s.rating * 1500
                });
            });
            const posList = ['ST','RW','LW','CAM','CM','CDM','CB','LB','RB','GK'];
            for (let i = stars.length; i < 20; i++) {
                const pos = posList[Math.floor(Math.random()*posList.length)];
                const rating = Math.floor(Math.random()*12) + 68;
                market.push({
                    id: 500 + i, name: getRandomName(), pos, rating,
                    age: Math.floor(Math.random()*10)+19,
                    value: rating * 160000, wage: rating * 1300
                });
            }
            return market;
        }

        // ==================== INIT & CLUB SELECT ====================
        function initGame() {
            const saved = localStorage.getItem('fm_game_save_v2');
            if (saved) {
                try {
                    gameState = JSON.parse(saved);
                    document.getElementById('club-select-modal').classList.add('hidden');
                    updateUI();
                    return;
                } catch(e) { console.error(e); }
            }
            // Show selection for new game
            renderLeagueCards();
            document.getElementById('club-select-modal').classList.remove('hidden');
        }

        function renderLeagueCards() {
            const container = document.getElementById('league-cards');
            container.innerHTML = Object.values(LEAGUES).map(lg => `
                <button onclick="${lg.unlocked ? `selectLeague('${lg.id}')` : 'alert(\\'Giải đấu này sẽ được mở rộng trong bản cập nhật sau!\\')'}"
                    class="p-5 rounded-2xl border text-left transition-all ${lg.unlocked
                        ? 'bg-slate-900 border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-950/30 cursor-pointer'
                        : 'bg-slate-900/50 border-slate-800 opacity-60 cursor-not-allowed'}">
                    <div class="text-3xl mb-2">${lg.icon}</div>
                    <h3 class="font-extrabold text-slate-100 text-lg">${lg.name}</h3>
                    <p class="text-xs text-slate-400 mt-1">${lg.country} • ${lg.season}</p>
                    <p class="text-xs text-slate-500 mt-2">${lg.desc}</p>
                    ${!lg.unlocked ? '<span class="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">Sắp ra mắt</span>' : ''}
                </button>
            `).join('');
        }

        function selectLeague(leagueId) {
            AudioFX.click();
            selectedLeagueId = leagueId;
            document.getElementById('step-league').classList.add('hidden');
            document.getElementById('step-club').classList.remove('hidden');
            document.getElementById('selected-league-label').innerText = `Giải: ${LEAGUES[leagueId].name}`;
            renderClubCards(leagueId);
        }

        function backToLeagueStep() {
            document.getElementById('step-club').classList.add('hidden');
            document.getElementById('step-manager').classList.add('hidden');
            document.getElementById('step-league').classList.remove('hidden');
            selectedClubId = null;
        }

        function renderClubCards(leagueId) {
            const container = document.getElementById('club-cards');
            const clubs = getClubsForLeague(leagueId);
            if (!clubs || clubs.length === 0) {
                container.innerHTML = '<p class="text-slate-500 col-span-full text-center py-8">Giải đấu này chưa có dữ liệu CLB.</p>';
                return;
            }
            container.innerHTML = clubs.map(c => {
                const logoHtml = c.logo
                    ? `<img src="${c.logo}" alt="${c.badge}" class="w-12 h-12 rounded-xl object-contain bg-white/90 p-1 shrink-0" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/><div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 hidden items-center justify-center font-black text-white text-sm shrink-0">${c.badge}</div>`
                    : `<div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center font-black text-white text-sm shrink-0">${c.badge}</div>`;
                return `
                <button onclick="selectClub('${c.id}')"
                    class="p-4 rounded-xl border border-slate-800 bg-slate-900 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-left transition-all flex items-center gap-3">
                    ${logoHtml}
                    <div class="min-w-0">
                        <h4 class="font-bold text-slate-100 text-sm truncate">${c.name}</h4>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-[10px] text-amber-400 font-bold">OVR ${c.ovr}</span>
                            <span class="text-[10px] text-slate-500">•</span>
                            <span class="text-[10px] text-slate-400">$${(c.budget/1e6).toFixed(0)}M</span>
                        </div>
                    </div>
                </button>`;
            }).join('');
        }

        function selectClub(clubId) {
            AudioFX.click();
            selectedClubId = clubId;
            document.getElementById('step-club').classList.add('hidden');
            document.getElementById('step-manager').classList.remove('hidden');
            document.getElementById('input-manager-name').focus();
        }

        function confirmStartGame() {
            const managerName = (document.getElementById('input-manager-name').value || 'Nguyễn Văn A').trim();
            const club = getClubsForLeague(selectedLeagueId).find(c => c.id === selectedClubId);
            if (!club) return;

            gameState.managerName = managerName;
            gameState.clubName = club.name;
            gameState.clubId = club.id;
            gameState.clubBadge = club.badge;
            gameState.clubLogo = club.logo || null;
            gameState.leagueId = selectedLeagueId;
            gameState.budget = club.budget;
            gameState.facilities.stadium.name = club.stadium;
            gameState.facilities.stadium.capacity = club.capacity;
            gameState.squad = generateSquadForClub(club);
            gameState.penaltyTakerId = gameState.squad.find(p => p.isStarting && ['ST','CAM','CM'].includes(p.pos))?.id || gameState.squad[0].id;
            const allClubs = getClubsForLeague(selectedLeagueId);
            gameState.opponents = allClubs.filter(c => c.id !== club.id).map((c, idx) => ({
                id: idx + 1,
                name: c.name,
                badge: c.badge,
                logo: c.logo || null,
                ovr: c.ovr,
                att: c.ovr + Math.floor(Math.random()*3)-1,
                def: c.ovr + Math.floor(Math.random()*3)-1,
                points: 0, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0
            }));
            gameState.transferMarket = generateTransferMarket();
            gameState.standings = [];
            gameState.recentResults = [];
            gameState.totalMatchDays = Math.max(14, (allClubs.length - 1) * 2); // home+away roughly
            gameState.currentMatchDay = 1;
            gameState.morale = 80 + Math.floor(Math.random()*15);
            gameState.boardConfidence = 70 + Math.floor(Math.random()*20);
            gameState.achievements = [];
            gameState.losingStreak = 0;
            gameState.winningStreak = 0;
            gameState.seasonStats = { goals: 0, cleanSheets: 0, biggestWin: 0 };
            const avgOvr = club.ovr || 70;
            if (avgOvr >= 85) gameState.boardObjective = 'TITLE';
            else if (avgOvr >= 78) gameState.boardObjective = 'TOP_3';
            else if (avgOvr >= 70) gameState.boardObjective = 'TOP_HALF';
            else gameState.boardObjective = 'AVOID_RELEGATION';
            gameState.managerRep = 55 + Math.floor(Math.random()*20);

            initLeagueStandings();
            document.getElementById('club-select-modal').classList.add('hidden');
            saveGame();
            updateUI();
            AudioFX.whistle();
        }

        function saveGame() {
            localStorage.setItem('fm_game_save_v2', JSON.stringify(gameState));
            // also keep old key for safety
            localStorage.setItem('fm_game_save', JSON.stringify(gameState));
            if (arguments.length === 0) {
                // silent auto-save after match; only show alert when user clicks
            }
        }

        function saveGameManual() {
            saveGame();
            alert("Game đã được lưu thành công!");
        }

        function resetGamePrompt() {
            if (confirm("Bạn có chắc chắn muốn xóa tiến trình và chơi lại từ đầu?")) {
                localStorage.removeItem('fm_game_save_v2');
                localStorage.removeItem('fm_game_save');
                location.reload();
            }
        }

        // ==================== UI ====================
        function switchTab(tabId) {
            AudioFX.click();
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.nav-tab').forEach(el => {
                el.classList.remove('bg-emerald-600', 'text-white', 'shadow-md');
                el.classList.add('text-slate-400');
            });
            document.getElementById(`tab-${tabId}`).classList.remove('hidden');
            const activeBtn = document.getElementById(`nav-${tabId}`);
            if (activeBtn) {
                activeBtn.classList.add('bg-emerald-600', 'text-white', 'shadow-md');
                activeBtn.classList.remove('text-slate-400');
            }
            if (tabId === 'tactics') renderTacticsTab();
            if (tabId === 'transfers') renderTransfersTab();
            if (tabId === 'league') renderLeagueTab();
            if (tabId === 'facilities') renderFacilitiesTab();
            if (tabId === 'finance') renderFinanceTab();
        }

        function updateUI() {
            // Badge
            const badgeEl = document.getElementById('club-badge');
            if (badgeEl) badgeEl.innerText = gameState.clubBadge || 'FC';

            const nameEl = document.getElementById('club-name-display');
            if (nameEl) {
                nameEl.childNodes[0].nodeValue = (gameState.clubName || 'CLB') + " ";
            }
            document.getElementById('manager-name-display').innerHTML =
                `<span><i class="fa-solid fa-user-tie text-emerald-400"></i> HLV: ${gameState.managerName}</span> • <span class="text-slate-300 font-semibold">Mùa ${gameState.seasonYear}/${(gameState.seasonYear+1).toString().slice(2)}</span>`;
            document.getElementById('budget-display').innerText = `$${(gameState.budget / 1000000).toFixed(1)}M`;
            document.getElementById('morale-display').innerText = `${gameState.morale}%`;
            document.getElementById('matchday-display').innerText = `Vòng ${gameState.currentMatchDay} / ${gameState.totalMatchDays}`;

            // Rank badge
            if (gameState.standings && gameState.standings.length) {
                const sorted = [...gameState.standings].sort((a,b) => {
                    if (b.pts !== a.pts) return b.pts - a.pts;
                    return (b.gf-b.ga) - (a.gf-a.ga);
                });
                const rank = sorted.findIndex(s => s.isPlayer) + 1;
                const rankBadge = document.getElementById('league-rank-badge');
                if (rankBadge) rankBadge.innerText = `Hạng #${rank || '-'}`;
            }

            const startingXI = gameState.squad.filter(p => p.isStarting);
            const att = Math.round(calculateAvgRating(startingXI, ['ST','RW','LW','CAM']));
            const mid = Math.round(calculateAvgRating(startingXI, ['CM','CDM','CAM','LM','RM']));
            const def = Math.round(calculateAvgRating(startingXI, ['CB','LB','RB','GK']));

            document.getElementById('dash-att').innerText = att || 70;
            document.getElementById('dash-mid').innerText = mid || 70;
            document.getElementById('dash-def').innerText = def || 70;
            document.getElementById('dash-squad-count').innerText = gameState.squad.length;

            const totalWage = gameState.squad.reduce((sum, p) => sum + p.wage, 0);
            const estTicket = (gameState.facilities.stadium.capacity * gameState.facilities.stadium.ticketPrice);
            document.getElementById('dash-ticket-rev').innerText = `+$${(estTicket/1000).toFixed(0)}K`;
            document.getElementById('dash-wage-cost').innerText = `-$${(totalWage/1000).toFixed(0)}K`;
            document.getElementById('dash-sponsor-name').innerText = `${gameState.sponsor.name} ($${(gameState.sponsor.payPerMatch/1000).toFixed(0)}K/vòng)`;
            document.getElementById('dash-stadium-cap').innerText = `${gameState.facilities.stadium.capacity.toLocaleString()} chỗ`;

            document.getElementById('board-confidence').innerText = `${gameState.boardConfidence}%`;
            document.getElementById('board-confidence-bar').style.width = `${gameState.boardConfidence}%`;
            document.getElementById('manager-rep').innerText = `${gameState.managerRep}/100`;
            document.getElementById('manager-rep-bar').style.width = `${gameState.managerRep}%`;

            setupNextMatchPreview();
            renderRecentResults();
            // Board objective display
            const objMap = { TITLE: 'Vô địch giải', TOP_3: 'Top 3', TOP_HALF: 'Top nửa bảng', AVOID_RELEGATION: 'Trụ hạng' };
            const objEl = document.getElementById('board-objective-text');
            if (objEl) objEl.innerText = 'Mục tiêu BLĐ: ' + (objMap[gameState.boardObjective] || gameState.boardObjective || 'Top nửa bảng');
            const achEl = document.getElementById('achievements-mini');
            if (achEl) achEl.innerText = `Thành tựu: ${(gameState.achievements||[]).length}/${typeof ACHIEVEMENT_DEFS !== 'undefined' ? ACHIEVEMENT_DEFS.length : 10} • Chuỗi thắng: ${gameState.winningStreak||0}`;
        }

        function calculateAvgRating(players, positions) {
            const matched = players.filter(p => positions.includes(p.pos));
            if (matched.length === 0) return 70;
            return matched.reduce((s, p) => s + p.rating, 0) / matched.length;
        }

        function setupNextMatchPreview() {
            const nextOpponent = getNextOpponent();
            if (!nextOpponent) {
                document.getElementById('next-match-title').innerText = "Mùa Giải Đã Kết Thúc!";
                document.getElementById('next-match-venue').innerText = "Cảm ơn bạn đã đồng hành cùng CLB";
                document.getElementById('btn-play-match').disabled = true;
                return;
            }
            document.getElementById('next-match-title').innerText = `${gameState.clubName} vs ${nextOpponent.name}`;
            document.getElementById('next-match-venue').innerText = `${gameState.facilities.stadium.name} (Sân Nhà)`;
            document.getElementById('home-name-preview').innerText = gameState.clubName.length > 12 ? gameState.clubBadge : gameState.clubName;
            document.getElementById('away-name-preview').innerText = nextOpponent.name.length > 14 ? nextOpponent.badge : nextOpponent.name;
            document.getElementById('home-badge-preview').innerText = gameState.clubBadge;
            document.getElementById('away-badge-preview').innerText = nextOpponent.badge;
        }

        function getNextOpponent() {
            if (!gameState.opponents || gameState.opponents.length === 0) return null;
            if (gameState.currentMatchDay > gameState.totalMatchDays) return null;
            const oppIndex = (gameState.currentMatchDay - 1) % gameState.opponents.length;
            return gameState.opponents[oppIndex];
        }

        function renderRecentResults() {
            const container = document.getElementById('recent-results-list');
            if (!gameState.recentResults || gameState.recentResults.length === 0) {
                container.innerHTML = `<span class="text-slate-500 text-sm italic">Chưa có trận đấu nào diễn ra.</span>`;
                return;
            }
            container.innerHTML = gameState.recentResults.map(r => {
                const isWin = r.homeScore > r.awayScore;
                const isDraw = r.homeScore === r.awayScore;
                const badgeColor = isWin ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : (isDraw ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30');
                const tagText = isWin ? 'T' : (isDraw ? 'H' : 'B');
                return `
                    <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-3 min-w-[200px]">
                        <span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${badgeColor}">${tagText}</span>
                        <div>
                            <div class="text-xs font-bold text-slate-200">Vòng ${r.matchDay}: ${r.opponentName}</div>
                            <div class="text-sm font-black text-amber-400">${r.homeScore} - ${r.awayScore}</div>
                        </div>
                    </div>`;
            }).reverse().join('');
        }

        // ==================== TACTICS ====================
        function renderTacticsTab() {
            const pitchContainer = document.getElementById('pitch-players-container');
            const rosterContainer = document.getElementById('squad-roster-list');
            const formation = gameState.formation;
            const slots = getFormationPositions(formation);
            pitchContainer.innerHTML = '';
            let starters = gameState.squad.filter(p => p.isStarting);
            document.getElementById('squad-starting-count').innerText = `${starters.length} / 11 Ra Sân`;
            document.getElementById('formation-select').value = formation;

            slots.forEach((slot, idx) => {
                const player = starters[idx];
                const playerCard = document.createElement('div');
                playerCard.className = `absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer group transition-transform hover:scale-110`;
                playerCard.style.top = slot.top;
                playerCard.style.left = slot.left;
                if (player) {
                    playerCard.onclick = () => swapPlayerStartingStatus(player.id);
                    const realBadge = player.isReal ? '<span class="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full"></span>' : '';
                    playerCard.innerHTML = `
                        <div class="relative w-9 h-9 rounded-full bg-slate-900 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center text-xs font-black shadow-lg group-hover:bg-emerald-500 group-hover:text-slate-950">
                            ${player.rating}${realBadge}
                        </div>
                        <div class="bg-slate-900/90 text-[10px] text-slate-100 px-2 py-0.5 rounded border border-slate-700 mt-1 font-semibold whitespace-nowrap shadow">
                            ${player.name.split(' ').pop()} (${slot.pos})
                        </div>`;
                } else {
                    playerCard.innerHTML = `<div class="w-9 h-9 rounded-full bg-slate-800/80 border-2 border-dashed border-slate-500 text-slate-400 flex items-center justify-center text-xs font-bold">+</div>`;
                }
                pitchContainer.appendChild(playerCard);
            });

            const penaltySelect = document.getElementById('penalty-taker-select');
            penaltySelect.innerHTML = gameState.squad.map(p =>
                `<option value="${p.id}" ${p.id === gameState.penaltyTakerId ? 'selected' : ''}>${p.name} (OVR: ${p.rating})</option>`
            ).join('');

            rosterContainer.innerHTML = gameState.squad.map(player => {
                const isStar = player.isStarting;
                const injured = player.injuryWeeks > 0;
                const formStr = (player.form || []).map(r => {
                    const c = r === 'W' ? 'text-emerald-400' : (r === 'D' ? 'text-amber-400' : 'text-red-400');
                    return `<span class="${c} font-bold">${r}</span>`;
                }).join(' ');
                return `
                    <div class="p-2.5 rounded-xl border ${injured ? 'bg-red-950/20 border-red-500/30 opacity-70' : (isStar ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-950/60 border-slate-800')} flex items-center justify-between hover:border-slate-700">
                        <div class="flex items-center gap-3">
                            <button onclick="swapPlayerStartingStatus(${player.id})" ${injured ? 'disabled' : ''} class="w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition ${injured ? 'bg-red-900 text-red-300' : (isStar ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}">
                                ${injured ? 'INJ' : (isStar ? 'ST' : 'SUB')}
                            </button>
                            <div>
                                <div class="font-bold text-xs text-slate-200 flex items-center gap-1.5 flex-wrap">
                                    <span>${player.name}</span>
                                    ${player.isReal ? '<span class="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">THẬT</span>' : ''}
                                    <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">${player.pos}</span>
                                    ${player.personality ? `<span class="text-[9px] text-indigo-400">${player.personality}</span>` : ''}
                                </div>
                                <div class="text-[10px] text-slate-400">${player.age}t${player.birthYear ? ' ('+player.birthYear+')' : ''}${player.nationality && player.nationality !== 'Unknown' ? ' • '+player.nationality : ''} • Bàn: ${player.goals} • ${player.potential ? 'POT '+player.potential+' • ' : ''}$${(player.wage/1000).toFixed(0)}K</div>
                                <div class="text-[10px] mt-0.5 flex gap-1 items-center">${formStr || '<span class="text-slate-600">Chưa có form</span>'}${injured ? ` <span class="text-red-400 ml-1">🏥 ${player.injuryWeeks} vòng</span>` : ''}</div>
                            </div>
                        </div>
                        <div class="text-right"><span class="text-sm font-black text-amber-400">${player.rating}</span></div>
                    </div>`;
            }).join('');
        }

        function changeFormation(val) {
            gameState.formation = val;
            autoPickStartingXI(gameState.squad, val);
            renderTacticsTab();
            updateUI();
        }

        function updateTacticsStyle() {
            gameState.tacticStyle = document.getElementById('style-select').value;
        }

        function swapPlayerStartingStatus(playerId) {
            const player = gameState.squad.find(p => p.id === playerId);
            if (!player) return;
            if (player.injuryWeeks > 0) {
                alert(`${player.name} đang chấn thương, không thể ra sân!`);
                return;
            }
            const startersCount = gameState.squad.filter(p => p.isStarting).length;
            if (!player.isStarting && startersCount >= 11) {
                alert("Đội hình chính đã đủ 11 cầu thủ! Hãy chọn rút 1 cầu thủ ra sân trước.");
                return;
            }
            player.isStarting = !player.isStarting;
            // happiness tweak
            if (player.isStarting) player.happiness = Math.min(100, (player.happiness||70)+2);
            renderTacticsTab();
            updateUI();
        }

        // ==================== TRANSFERS ====================
        function renderTransfersTab() {
            filterTransferMarket();
            renderYouthAcademy();
        }

        function switchTransferSubtab(subtab) {
            document.getElementById('subtab-market').classList.toggle('hidden', subtab !== 'market');
            document.getElementById('subtab-youth').classList.toggle('hidden', subtab !== 'youth');
            document.getElementById('subtab-btn-market').className = subtab === 'market'
                ? 'pb-3 px-2 font-bold text-sm text-emerald-400 border-b-2 border-emerald-400'
                : 'pb-3 px-2 font-semibold text-sm text-slate-400 hover:text-slate-200';
            document.getElementById('subtab-btn-youth').className = subtab === 'youth'
                ? 'pb-3 px-2 font-bold text-sm text-emerald-400 border-b-2 border-emerald-400'
                : 'pb-3 px-2 font-semibold text-sm text-slate-400 hover:text-slate-200';
        }

        function filterTransferMarket() {
            const query = (document.getElementById('transfer-search')?.value || '').toLowerCase();
            const posFilter = document.getElementById('transfer-pos-filter')?.value || 'ALL';
            const container = document.getElementById('transfer-market-cards');
            const filtered = gameState.transferMarket.filter(p => {
                const matchesName = p.name.toLowerCase().includes(query);
                let matchesPos = true;
                if (posFilter === 'FW') matchesPos = ['ST','RW','LW'].includes(p.pos);
                if (posFilter === 'MF') matchesPos = ['CM','CAM','CDM'].includes(p.pos);
                if (posFilter === 'DF') matchesPos = ['CB','LB','RB'].includes(p.pos);
                if (posFilter === 'GK') matchesPos = p.pos === 'GK';
                return matchesName && matchesPos;
            });
            if (filtered.length === 0) {
                container.innerHTML = `<div class="col-span-full text-center py-8 text-slate-500 text-sm">Không tìm thấy cầu thủ phù hợp.</div>`;
                return;
            }
            container.innerHTML = filtered.map(player => `
                <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3 flex flex-col justify-between hover:border-slate-700">
                    <div>
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="font-extrabold text-slate-100 text-sm">${player.name}</h4>
                                <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700 font-semibold">${player.pos}</span>
                            </div>
                            <span class="text-xl font-black text-amber-400">${player.rating}</span>
                        </div>
                        <div class="text-xs text-slate-400 mt-2 space-y-1">
                            <div>Tuổi: <strong class="text-slate-200">${player.age}</strong></div>
                            <div>Lương đòi hỏi: <strong class="text-slate-200">$${(player.wage/1000).toFixed(0)}K / tuần</strong></div>
                            <div>Giá chuyển nhượng: <strong class="text-amber-400 font-bold">$${(player.value/1000000).toFixed(2)}M</strong></div>
                        </div>
                    </div>
                    <button onclick="buyPlayer(${player.id})" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow">Mua Cầu Thủ</button>
                </div>`).join('');
        }

        function buyPlayer(playerId) {
            const playerIndex = gameState.transferMarket.findIndex(p => p.id === playerId);
            if (playerIndex === -1) return;
            const player = gameState.transferMarket[playerIndex];
            if (gameState.budget < player.value) {
                alert("Ngân sách của bạn không đủ để chiêu mộ cầu thủ này!");
                return;
            }
            gameState.budget -= player.value;
            player.isStarting = false;
            player.stamina = 100; player.goals = 0; player.assists = 0; player.yellowCards = 0;
            gameState.squad.push(player);
            gameState.transferMarket.splice(playerIndex, 1);
            AudioFX.click();
            alert(`Chúc mừng! Bạn đã chiêu mộ thành công ${player.name} với giá $${(player.value/1000000).toFixed(2)}M!`);
            updateUI();
            filterTransferMarket();
        }

        function renderYouthAcademy() {
            const container = document.getElementById('youth-academy-cards');
            if (!gameState.youthAcademy || gameState.youthAcademy.length === 0) {
                container.innerHTML = `<div class="col-span-full text-center py-8 text-slate-500 text-sm">Chưa có tài năng trẻ nào. Bấm nút Tuyển Trạch để tìm kiếm!</div>`;
                return;
            }
            container.innerHTML = gameState.youthAcademy.map(player => `
                <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-extrabold text-slate-100 text-sm">${player.name}</h4>
                            <span class="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-500/30 font-semibold">${player.pos}</span>
                        </div>
                        <span class="text-xl font-black text-amber-400">${player.rating}</span>
                    </div>
                    <div class="text-xs text-slate-400 space-y-1">
                        <div>Tuổi: <strong class="text-slate-200">${player.age}</strong></div>
                        <div>Tiềm năng (POT): <strong class="text-emerald-400 font-bold">${player.potential}</strong></div>
                    </div>
                    <button onclick="signYouthPlayer(${player.id})" class="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition">Ký Hợp Đồng Chuyên Nghiệp</button>
                </div>`).join('');
        }

        function scoutNewYouthPlayer() {
            if (gameState.budget < 200000) {
                alert("Cần $200,000 để cử Tuyển trạch viên!");
                return;
            }
            gameState.budget -= 200000;
            const positions = ['ST','CAM','CM','CB','GK','RW','LW'];
            const pos = positions[Math.floor(Math.random()*positions.length)];
            const baseRating = Math.floor(Math.random()*8) + 60;
            const pot = baseRating + Math.floor(Math.random()*18) + 8;
            const youthPlayer = {
                id: Date.now(), name: getRandomName(), pos, rating: baseRating,
                potential: pot,
                age: 16 + Math.floor(Math.random()*2), wage: 800, value: baseRating * 90000,
                isStarting: false, stamina: 100, goals: 0, assists: 0, yellowCards: 0,
                personality: PERSONALITIES[Math.floor(Math.random()*PERSONALITIES.length)],
                form: [], injuryWeeks: 0, happiness: 80, contractYears: 3, isReal: false
            };
            if (pot >= 85) unlockAchievement('wonderkid');
            gameState.youthAcademy.push(youthPlayer);
            updateUI();
            renderYouthAcademy();
            alert(`Tuyển trạch viên đã phát hiện cầu thủ trẻ ${youthPlayer.name} (Vị trí: ${pos}, OVR: ${baseRating})!`);
        }

        function signYouthPlayer(playerId) {
            const idx = gameState.youthAcademy.findIndex(p => p.id === playerId);
            if (idx === -1) return;
            const player = gameState.youthAcademy[idx];
            player.isStarting = false; player.stamina = 100; player.goals = 0; player.assists = 0; player.yellowCards = 0;
            gameState.squad.push(player);
            gameState.youthAcademy.splice(idx, 1);
            alert(`Đã đôn ${player.name} lên đội 1!`);
            updateUI();
            renderYouthAcademy();
        }

        // ==================== LEAGUE ====================
        function initLeagueStandings() {
            if (gameState.standings && gameState.standings.length > 0) return;
            gameState.standings = [
                { name: gameState.clubName, isPlayer: true, pts: 0, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 },
                ...gameState.opponents.map(o => ({ name: o.name, isPlayer: false, pts: 0, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }))
            ];
        }

        function renderLeagueTab() {
            gameState.standings.sort((a,b) => {
                if (b.pts !== a.pts) return b.pts - a.pts;
                const gdB = b.gf - b.ga, gdA = a.gf - a.ga;
                if (gdB !== gdA) return gdB - gdA;
                return b.gf - a.gf;
            });
            const standingsBody = document.getElementById('league-standings-body');
            standingsBody.innerHTML = gameState.standings.map((team, idx) => {
                const gd = team.gf - team.ga;
                const isUser = team.isPlayer;
                return `
                    <tr class="${isUser ? 'bg-emerald-950/30 font-bold text-white' : 'hover:bg-slate-900/60'} text-xs">
                        <td class="px-3 py-3 text-center">${idx + 1}</td>
                        <td class="px-4 py-3 flex items-center gap-2">
                            ${isUser ? '<span class="text-xs px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-black">BẠN</span>' : ''}
                            <span>${team.name}</span>
                        </td>
                        <td class="px-2 py-3 text-center">${team.p}</td>
                        <td class="px-2 py-3 text-center">${team.w}</td>
                        <td class="px-2 py-3 text-center">${team.d}</td>
                        <td class="px-2 py-3 text-center">${team.l}</td>
                        <td class="px-2 py-3 text-center">${team.gf}</td>
                        <td class="px-2 py-3 text-center">${team.ga}</td>
                        <td class="px-2 py-3 text-center ${gd > 0 ? 'text-emerald-400' : (gd < 0 ? 'text-red-400' : '')}">${gd > 0 ? '+'+gd : gd}</td>
                        <td class="px-3 py-3 text-center font-black text-amber-400 text-sm">${team.pts}</td>
                    </tr>`;
            }).join('');

            const scorersContainer = document.getElementById('top-scorers-list');
            const allScorers = [...gameState.squad].filter(p => p.goals > 0).sort((a,b) => b.goals - a.goals);
            if (allScorers.length === 0) {
                scorersContainer.innerHTML = `<span class="text-xs text-slate-500 italic">Chưa có cầu thủ nào ghi bàn.</span>`;
            } else {
                scorersContainer.innerHTML = allScorers.slice(0, 5).map((p, idx) => `
                    <div class="flex justify-between items-center text-xs p-2 bg-slate-950 rounded-xl">
                        <span class="text-slate-300 font-medium">${idx+1}. ${p.name}</span>
                        <span class="font-extrabold text-amber-400">${p.goals} bàn</span>
                    </div>`).join('');
            }

            const currentFixtures = document.getElementById('current-fixtures-list');
            const opp = getNextOpponent();
            if (opp) {
                currentFixtures.innerHTML = `
                    <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
                        <span class="font-bold text-emerald-400">${gameState.clubName}</span>
                        <span class="text-slate-500">VS</span>
                        <span class="font-bold text-slate-200">${opp.name}</span>
                    </div>`;
            } else {
                currentFixtures.innerHTML = `<span class="text-xs text-slate-500">Mùa giải đã kết thúc.</span>`;
            }
        }

        // ==================== FACILITIES & FINANCE ====================
        function renderFacilitiesTab() {
            const container = document.getElementById('facilities-list-container');
            const f = gameState.facilities;
            const items = [
                { key: 'stadium', title: 'Sân Vận Động', icon: 'fa-archway', desc: `Sức chứa hiện tại: ${f.stadium.capacity.toLocaleString()} chỗ. Nâng cấp tăng tiền bán vé.` },
                { key: 'training', title: 'Trung Tâm Huấn Luyện', icon: 'fa-dumbbell', desc: `Cấp độ ${f.training.level}. Tăng chỉ số cầu thủ nhanh hơn sau mỗi vòng.` },
                { key: 'academy', title: 'Học Viện Đào Tạo Trẻ', icon: 'fa-graduation-cap', desc: `Cấp độ ${f.academy.level}. Tăng tỉ lệ phát hiện Wonderkid xuất sắc.` },
                { key: 'medical', title: 'Trung Tâm Y Tế', icon: 'fa-hospital', desc: `Cấp độ ${f.medical.level}. Giảm nguy cơ chấn thương và hồi phục stamina.` }
            ];
            container.innerHTML = items.map(item => {
                const fac = f[item.key];
                return `
                    <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                        <div>
                            <div class="flex items-center gap-3 mb-2">
                                <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg"><i class="fa-solid ${item.icon}"></i></div>
                                <div>
                                    <h4 class="font-bold text-slate-100 text-sm">${item.title}</h4>
                                    <span class="text-xs text-amber-400 font-semibold">Cấp ${fac.level}</span>
                                </div>
                            </div>
                            <p class="text-xs text-slate-400 leading-relaxed mb-4">${item.desc}</p>
                        </div>
                        <button onclick="upgradeFacility('${item.key}')" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition">
                            Nâng Cấp ($${(fac.upgradeCost/1000000).toFixed(1)}M)
                        </button>
                    </div>`;
            }).join('');
        }

        function upgradeFacility(key) {
            const fac = gameState.facilities[key];
            if (gameState.budget < fac.upgradeCost) {
                alert("Ngân sách của bạn không đủ để thực hiện nâng cấp này!");
                return;
            }
            gameState.budget -= fac.upgradeCost;
            fac.level += 1;
            fac.upgradeCost = Math.round(fac.upgradeCost * 1.5);
            if (key === 'stadium') fac.capacity += 8000;
            alert(`Nâng cấp thành công lên Cấp ${fac.level}!`);
            updateUI();
            renderFacilitiesTab();
        }

        function renderFinanceTab() {
            const sponsorsContainer = document.getElementById('sponsors-container');
            sponsorsContainer.innerHTML = `
                <div class="p-4 bg-slate-950 border border-emerald-500/30 rounded-xl flex justify-between items-center">
                    <div>
                        <div class="text-xs text-emerald-400 font-bold uppercase">Nhà Tài Trợ Chính</div>
                        <div class="text-sm font-extrabold text-slate-100">${gameState.sponsor.name}</div>
                        <div class="text-xs text-slate-400">Tài trợ $${gameState.sponsor.payPerMatch.toLocaleString()} / mỗi trận</div>
                    </div>
                    <span class="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded font-bold">ĐANG KÝ HỢP ĐỒNG</span>
                </div>`;
            const totalWage = gameState.squad.reduce((s, p) => s + p.wage, 0);
            const estTicket = (gameState.facilities.stadium.capacity * gameState.facilities.stadium.ticketPrice);
            const netEst = estTicket + gameState.sponsor.payPerMatch - totalWage;
            document.getElementById('fin-ticket-est').innerText = `+$${estTicket.toLocaleString()}`;
            document.getElementById('fin-sponsor-est').innerText = `+$${gameState.sponsor.payPerMatch.toLocaleString()}`;
            document.getElementById('fin-wages-est').innerText = `-$${totalWage.toLocaleString()}`;
            document.getElementById('fin-net-est').innerText = `+$${netEst.toLocaleString()}`;
        }

        // ==================== MATCH SIM + ADVANCED FEATURES ====================
        let matchSimInterval = null;
        let matchSimState = {
            active: false, minute: 0, homeScore: 0, awayScore: 0,
            homeShots: 0, awayShots: 0, homeFouls: 0, awayFouls: 0,
            speed: 1, isPaused: false, mentality: 'BALANCED', opponent: null,
            subsUsed: 0, subOutId: null
        };

        const HIGHLIGHTS = [
            { type: 'solo', text: (n) => `${n} solo qua 2 hậu vệ rồi dứt điểm!`, chance: 0.4 },
            { type: 'longshot', text: (n) => `Siêu phẩm sút xa 30m của ${n}!`, chance: 0.35 },
            { type: 'header', text: (n) => `${n} bật cao đánh đầu hiểm hóc!`, chance: 0.4 },
            { type: 'counter', text: (n) => `Phản công thần tốc! ${n} kết thúc tình huống!`, chance: 0.45 },
            { type: 'save', text: (n) => `Thủ môn đối phương cản phá xuất thần cú sút của ${n}!`, chance: 0 },
            { type: 'woodwork', text: (n) => `XÀ NGANG! ${n} suýt chút nữa đã có bàn thắng!`, chance: 0 }
        ];

        function pickWeather() {
            const w = ['Nắng', 'Nắng', 'Nắng', 'Mây', 'Mưa nhẹ', 'Mưa'];
            return w[Math.floor(Math.random() * w.length)];
        }

        function openMatchModal() {
            // Filter out injured players from starting
            gameState.squad.forEach(p => {
                if (p.injuryWeeks > 0 && p.isStarting) p.isStarting = false;
            });
            let starters = gameState.squad.filter(p => p.isStarting && (!p.injuryWeeks || p.injuryWeeks <= 0));
            if (starters.length < 11) {
                // auto fill from available
                const available = gameState.squad.filter(p => !p.isStarting && (!p.injuryWeeks || p.injuryWeeks <= 0))
                    .sort((a,b) => b.rating - a.rating);
                while (starters.length < 11 && available.length) {
                    const p = available.shift();
                    p.isStarting = true;
                    starters.push(p);
                }
            }
            if (starters.length < 11) {
                alert("Không đủ cầu thủ khỏe mạnh để đá chính (cần 11)!");
                switchTab('tactics');
                return;
            }
            const opponent = getNextOpponent();
            if (!opponent) {
                // season might be over
                if (gameState.currentMatchDay > gameState.totalMatchDays) {
                    showSeasonEnd();
                }
                return;
            }

            gameState.weather = pickWeather();
            matchSimState = {
                active: true, minute: 0, homeScore: 0, awayScore: 0,
                homeShots: 0, awayShots: 0, homeFouls: 0, awayFouls: 0,
                speed: 1, isPaused: false, mentality: 'BALANCED', opponent,
                subsUsed: 0, subOutId: null
            };

            document.getElementById('match-modal').classList.remove('hidden');
            document.getElementById('sim-home-name').innerText = gameState.clubName;
            document.getElementById('sim-away-name').innerText = opponent.name;
            document.getElementById('sim-home-badge').innerText = gameState.clubBadge;
            document.getElementById('sim-away-badge').innerText = opponent.badge;
            document.getElementById('sim-home-score').innerText = '0';
            document.getElementById('sim-away-score').innerText = '0';
            document.getElementById('sim-home-tactic').innerText = gameState.formation;
            const weatherIcon = gameState.weather.includes('Mưa') ? 'fa-cloud-rain' : (gameState.weather === 'Mây' ? 'fa-cloud' : 'fa-sun');
            document.getElementById('match-weather').innerHTML = `<i class="fa-solid ${weatherIcon}"></i> ${gameState.weather}`;
            document.getElementById('subs-left').innerText = '3';
            document.getElementById('sim-commentary-box').innerHTML = `<div class="text-emerald-400 font-bold">[00'] Còi khai cuộc! Thời tiết: ${gameState.weather}. Trận đấu bắt đầu!</div>`;
            document.getElementById('btn-finish-match').classList.add('hidden');
            document.getElementById('stat-pos-home').innerText = '50%';
            document.getElementById('stat-pos-away').innerText = '50%';
            document.getElementById('stat-shots-home').innerText = '0';
            document.getElementById('stat-shots-away').innerText = '0';
            document.getElementById('stat-fouls-home').innerText = '0';
            document.getElementById('stat-fouls-away').innerText = '0';

            AudioFX.whistle();
            startMatchSimulation();
        }

        function toggleMatchPause() {
            matchSimState.isPaused = !matchSimState.isPaused;
            document.getElementById('btn-match-pause').innerHTML = matchSimState.isPaused
                ? '<i class="fa-solid fa-play"></i> Tiếp Tục'
                : '<i class="fa-solid fa-pause"></i> Tạm Dừng';
        }

        function toggleMatchSpeed() {
            if (matchSimState.speed === 1) matchSimState.speed = 2;
            else if (matchSimState.speed === 2) matchSimState.speed = 4;
            else matchSimState.speed = 1;
            document.getElementById('speed-label').innerText = `${matchSimState.speed}x`;
        }

        function setMidMatchMentality(mentality) {
            matchSimState.mentality = mentality;
            addCommentary(`HLV chỉ đạo: ${mentality === 'ATTACK' ? '⚡ Dâng cao Tấn Công' : (mentality === 'DEFEND' ? '🛡️ Lùi sâu Phòng Ngự' : '⚖️ Cân Bằng')}`);
        }

        function openSubPanel() {
            if (matchSimState.subsUsed >= 3) {
                alert('Đã hết lượt thay người!');
                return;
            }
            matchSimState.isPaused = true;
            document.getElementById('btn-match-pause').innerHTML = '<i class="fa-solid fa-play"></i> Tiếp Tục';
            matchSimState.subOutId = null;
            const outList = document.getElementById('sub-out-list');
            const inList = document.getElementById('sub-in-list');
            document.getElementById('subs-left-panel').innerText = 3 - matchSimState.subsUsed;
            outList.innerHTML = gameState.squad.filter(p => p.isStarting).map(p =>
                `<button onclick="selectSubOut(${p.id})" class="w-full text-left px-2 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-emerald-900/40 border border-slate-700">
                    <span class="font-bold text-slate-200">${p.name}</span> <span class="text-slate-500">${p.pos} ${p.rating}</span>
                </button>`
            ).join('');
            inList.innerHTML = gameState.squad.filter(p => !p.isStarting && (!p.injuryWeeks || p.injuryWeeks <= 0)).map(p =>
                `<button onclick="selectSubIn(${p.id})" class="w-full text-left px-2 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-indigo-900/40 border border-slate-700">
                    <span class="font-bold text-slate-200">${p.name}</span> <span class="text-slate-500">${p.pos} ${p.rating}</span>
                </button>`
            ).join('');
            document.getElementById('sub-panel').classList.remove('hidden');
        }

        function closeSubPanel() {
            document.getElementById('sub-panel').classList.add('hidden');
        }

        function selectSubOut(id) {
            matchSimState.subOutId = id;
            document.querySelectorAll('#sub-out-list button').forEach(b => b.classList.remove('ring-2', 'ring-emerald-400'));
            event.currentTarget.classList.add('ring-2', 'ring-emerald-400');
        }

        function selectSubIn(id) {
            if (!matchSimState.subOutId) {
                alert('Chọn cầu thủ ra sân trước!');
                return;
            }
            const outP = gameState.squad.find(p => p.id === matchSimState.subOutId);
            const inP = gameState.squad.find(p => p.id === id);
            if (!outP || !inP) return;
            outP.isStarting = false;
            inP.isStarting = true;
            matchSimState.subsUsed++;
            document.getElementById('subs-left').innerText = 3 - matchSimState.subsUsed;
            addCommentary(`<span class="text-indigo-300">[${matchSimState.minute}'] Thay người: ${inP.name} vào sân thay ${outP.name}</span>`);
            closeSubPanel();
            matchSimState.subOutId = null;
        }

        function startMatchSimulation() {
            if (matchSimInterval) clearInterval(matchSimInterval);
            matchSimInterval = setInterval(() => {
                if (matchSimState.isPaused) return;
                matchSimState.minute += matchSimState.speed;
                if (matchSimState.minute > 90) {
                    matchSimState.minute = 90;
                    endMatchSimulation();
                    return;
                }
                document.getElementById('sim-clock').innerText = `${matchSimState.minute}' - Hiệp ${matchSimState.minute <= 45 ? '1' : '2'}`;

                const ball = document.getElementById('sim-ball');
                if (ball) {
                    ball.style.left = `${Math.floor(Math.random()*80)+10}%`;
                    ball.style.top = `${Math.floor(Math.random()*80)+10}%`;
                }

                const starters = gameState.squad.filter(p => p.isStarting);
                let myAtt = calculateAvgRating(starters, ['ST','RW','LW','CAM']);
                let myDef = calculateAvgRating(starters, ['CB','LB','RB','GK']);
                // Form boost
                starters.forEach(p => {
                    const recent = (p.form || []).slice(-3);
                    const wins = recent.filter(r => r === 'W').length;
                    if (wins >= 2) myAtt += 0.5;
                });
                if (matchSimState.mentality === 'ATTACK') { myAtt += 5; myDef -= 3; }
                if (matchSimState.mentality === 'DEFEND') { myAtt -= 4; myDef += 5; }
                // Weather effect
                if (gameState.weather === 'Mưa' || gameState.weather === 'Mưa nhẹ') {
                    myAtt -= 2; myDef -= 1;
                }
                const oppDef = matchSimState.opponent.def;
                const oppAtt = matchSimState.opponent.att || matchSimState.opponent.ovr;

                const eventRoll = Math.random();
                // Injury event
                if (eventRoll < 0.012) {
                    const victims = starters.filter(p => p.pos !== 'GK');
                    if (victims.length) {
                        const v = victims[Math.floor(Math.random()*victims.length)];
                        const medLevel = gameState.facilities.medical.level || 1;
                        const weeks = Math.max(1, Math.floor(Math.random()*4) + 1 - Math.floor(medLevel/2));
                        v.injuryWeeks = weeks;
                        v.isStarting = false;
                        addCommentary(`<span class="text-red-400 font-bold">[${matchSimState.minute}'] 🏥 CHẤN THƯƠNG! ${v.name} phải rời sân (nghỉ ~${weeks} vòng)!</span>`);
                        // auto sub if available
                        const bench = gameState.squad.filter(p => !p.isStarting && (!p.injuryWeeks || p.injuryWeeks <= 0));
                        if (bench.length && matchSimState.subsUsed < 3) {
                            bench.sort((a,b) => b.rating - a.rating);
                            const sub = bench[0];
                            sub.isStarting = true;
                            matchSimState.subsUsed++;
                            document.getElementById('subs-left').innerText = 3 - matchSimState.subsUsed;
                            addCommentary(`<span class="text-indigo-300">[${matchSimState.minute}'] ${sub.name} vào thay thế.</span>`);
                        }
                    }
                } else if (eventRoll < 0.17) {
                    // Attack chance
                    const homeChance = myAtt / (myAtt + oppDef + 8);
                    const attackingTeam = Math.random() < homeChance ? 'HOME' : 'AWAY';
                    if (attackingTeam === 'HOME') {
                        matchSimState.homeShots++;
                        const scorers = starters.filter(p => ['ST','CAM','RW','LW','CM'].includes(p.pos));
                        const scorer = scorers[Math.floor(Math.random()*scorers.length)] || starters[0];
                        // Highlight moment
                        const isHighlight = Math.random() < 0.25;
                        let goalChance = 0.30;
                        if (isHighlight) {
                            const hl = HIGHLIGHTS[Math.floor(Math.random()*4)];
                            goalChance = hl.chance;
                            addCommentary(`[${matchSimState.minute}'] 🔥 ${hl.text(scorer.name)}`);
                        }
                        // VAR drama
                        const varRoll = Math.random();
                        if (Math.random() < goalChance) {
                            if (varRoll < 0.08) {
                                addCommentary(`<span class="text-amber-400">[${matchSimState.minute}'] VAR đang kiểm tra tình huống ghi bàn của ${scorer.name}...</span>`);
                                if (Math.random() < 0.4) {
                                    addCommentary(`<span class="text-red-300">[${matchSimState.minute}'] VAR: Hủy bàn thắng! Việt vị.</span>`);
                                } else {
                                    matchSimState.homeScore++;
                                    scorer.goals++;
                                    document.getElementById('sim-home-score').innerText = matchSimState.homeScore;
                                    AudioFX.goalCheer();
                                    addCommentary(`<span class="text-emerald-400 font-extrabold">[${matchSimState.minute}'] VAR công nhận! GOAAAL ${scorer.name}! (${matchSimState.homeScore}-${matchSimState.awayScore})</span>`);
                                }
                            } else {
                                matchSimState.homeScore++;
                                scorer.goals++;
                                document.getElementById('sim-home-score').innerText = matchSimState.homeScore;
                                AudioFX.goalCheer();
                                addCommentary(`<span class="text-emerald-400 font-extrabold">[${matchSimState.minute}'] GOAAALLL! ${scorer.name}! (${matchSimState.homeScore}-${matchSimState.awayScore})</span>`);
                            }
                        } else if (isHighlight) {
                            addCommentary(`[${matchSimState.minute}'] Thủ môn đối phương cứu thua xuất sắc!`);
                        } else if (Math.random() < 0.15) {
                            addCommentary(`[${matchSimState.minute}'] XÀ NGANG! ${scorer.name} suýt chút nữa!`);
                        } else {
                            addCommentary(`[${matchSimState.minute}'] Cú dứt điểm của ${gameState.clubName} không thành bàn.`);
                        }
                    } else {
                        matchSimState.awayShots++;
                        if (Math.random() < 0.28) {
                            // maybe big save
                            if (Math.random() < 0.15) {
                                const gk = starters.find(p => p.pos === 'GK');
                                addCommentary(`[${matchSimState.minute}'] 🧤 ${gk ? gk.name : 'Thủ môn'} cứu thua xuất thần!`);
                            } else {
                                matchSimState.awayScore++;
                                document.getElementById('sim-away-score').innerText = matchSimState.awayScore;
                                addCommentary(`<span class="text-red-400 font-extrabold">[${matchSimState.minute}'] BÀN THẮNG! ${matchSimState.opponent.name}! (${matchSimState.homeScore}-${matchSimState.awayScore})</span>`);
                            }
                        } else {
                            addCommentary(`[${matchSimState.minute}'] ${matchSimState.opponent.name} dứt điểm không chính xác.`);
                        }
                    }
                } else if (eventRoll < 0.23) {
                    if (Math.random() < 0.5) {
                        matchSimState.homeFouls++;
                        const foulP = starters[Math.floor(Math.random()*starters.length)];
                        foulP.yellowCards = (foulP.yellowCards || 0) + 1;
                        if (foulP.yellowCards >= 2) {
                            foulP.isStarting = false;
                            foulP.injuryWeeks = Math.max(foulP.injuryWeeks || 0, 1); // suspension
                            addCommentary(`<span class="text-amber-400 font-bold">[${matchSimState.minute}'] THẺ ĐỎ! ${foulP.name} nhận thẻ đỏ trực tiếp!</span>`);
                        } else {
                            addCommentary(`[${matchSimState.minute}'] Thẻ vàng cho ${foulP.name}.`);
                        }
                    } else {
                        matchSimState.awayFouls++;
                    }
                }

                const posHome = Math.min(72, Math.max(28, 50 + (matchSimState.homeShots - matchSimState.awayShots) * 2.5));
                document.getElementById('stat-pos-home').innerText = `${Math.round(posHome)}%`;
                document.getElementById('stat-pos-away').innerText = `${Math.round(100 - posHome)}%`;
                document.getElementById('stat-shots-home').innerText = matchSimState.homeShots;
                document.getElementById('stat-shots-away').innerText = matchSimState.awayShots;
                document.getElementById('stat-fouls-home').innerText = `${matchSimState.homeFouls}`;
                document.getElementById('stat-fouls-away').innerText = `${matchSimState.awayFouls}`;
            }, 360);
        }

        function addCommentary(msg) {
            const box = document.getElementById('sim-commentary-box');
            if (!box) return;
            const item = document.createElement('div');
            item.className = 'py-1 border-b border-slate-800/50';
            item.innerHTML = msg;
            box.prepend(item);
        }

        function unlockAchievement(id) {
            if (!gameState.achievements) gameState.achievements = [];
            if (gameState.achievements.includes(id)) return;
            gameState.achievements.push(id);
            const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
            const toast = document.getElementById('ach-toast');
            const text = document.getElementById('ach-toast-text');
            if (toast && text && def) {
                text.innerText = `🏆 ${def.name}: ${def.desc}`;
                toast.classList.remove('hidden');
                setTimeout(() => toast.classList.add('hidden'), 3500);
            }
        }

        function developPlayers() {
            const trainBonus = (gameState.facilities.training.level || 1) * 0.15;
            gameState.squad.forEach(p => {
                // recover injury
                if (p.injuryWeeks > 0) {
                    p.injuryWeeks--;
                    if (p.injuryWeeks === 0) p.happiness = Math.min(100, (p.happiness || 70) + 5);
                }
                // development
                if (p.age <= 24 && p.rating < (p.potential || 80)) {
                    if (Math.random() < 0.18 + trainBonus) {
                        p.rating = Math.min(p.potential || 90, p.rating + 1);
                        p.value = p.rating * (p.isReal ? 180000 : 140000);
                    }
                } else if (p.age >= 33 && Math.random() < 0.12) {
                    p.rating = Math.max(55, p.rating - 1);
                    p.value = p.rating * 100000;
                }
                // mentor: old leader boosts young
                if (p.personality === 'Lãnh đạo' && p.age >= 30) {
                    const young = gameState.squad.filter(y => y.age <= 21 && y.rating < 75);
                    if (young.length && Math.random() < 0.1) {
                        const y = young[Math.floor(Math.random()*young.length)];
                        if (y.rating < (y.potential || 85)) y.rating++;
                    }
                }
                // happiness from playing time
                if (p.isStarting) p.happiness = Math.min(100, (p.happiness || 70) + 2);
                else if (p.rating >= 78 && p.personality === 'Tham vọng') {
                    p.happiness = Math.max(30, (p.happiness || 70) - 3);
                }
            });
        }

        function endMatchSimulation() {
            clearInterval(matchSimInterval);
            AudioFX.whistle();
            addCommentary(`<div class="text-amber-400 font-extrabold py-2">[90'] HẾT GIỜ! Tỷ số: ${matchSimState.homeScore} - ${matchSimState.awayScore}</div>`);
            document.getElementById('btn-finish-match').classList.remove('hidden');

            const estTicket = (gameState.facilities.stadium.capacity * gameState.facilities.stadium.ticketPrice);
            // form bonus attendance
            const formBonus = gameState.winningStreak >= 3 ? 1.15 : 1;
            const totalWage = gameState.squad.reduce((s, p) => s + p.wage, 0);
            gameState.budget += Math.round(estTicket * formBonus) + gameState.sponsor.payPerMatch - totalWage;

            const homeStanding = gameState.standings.find(s => s.isPlayer);
            const awayStanding = gameState.standings.find(s => s.name === matchSimState.opponent.name);
            const hs = matchSimState.homeScore, as_ = matchSimState.awayScore;
            let resultLetter = 'D';

            if (homeStanding && awayStanding) {
                homeStanding.p++; awayStanding.p++;
                homeStanding.gf += hs; homeStanding.ga += as_;
                awayStanding.gf += as_; awayStanding.ga += hs;
                if (hs > as_) {
                    homeStanding.pts += 3; homeStanding.w++; awayStanding.l++;
                    gameState.morale = Math.min(100, gameState.morale + 4);
                    gameState.boardConfidence = Math.min(100, gameState.boardConfidence + 2);
                    gameState.managerRep = Math.min(100, gameState.managerRep + 1);
                    gameState.winningStreak = (gameState.winningStreak || 0) + 1;
                    gameState.losingStreak = 0;
                    resultLetter = 'W';
                    unlockAchievement('first_win');
                    if (gameState.winningStreak >= 3) unlockAchievement('win_streak_3');
                    if (gameState.winningStreak >= 5) unlockAchievement('win_streak_5');
                    if (hs - as_ >= 4) unlockAchievement('big_win');
                } else if (hs === as_) {
                    homeStanding.pts += 1; awayStanding.pts += 1;
                    homeStanding.d++; awayStanding.d++;
                    gameState.winningStreak = 0;
                    resultLetter = 'D';
                } else {
                    awayStanding.pts += 3; awayStanding.w++; homeStanding.l++;
                    gameState.morale = Math.max(25, gameState.morale - 5);
                    gameState.boardConfidence = Math.max(20, gameState.boardConfidence - 4);
                    gameState.losingStreak = (gameState.losingStreak || 0) + 1;
                    gameState.winningStreak = 0;
                    resultLetter = 'L';
                    if (gameState.losingStreak >= 4) {
                        gameState.boardConfidence = Math.max(15, gameState.boardConfidence - 5);
                        addCommentary(`<span class="text-red-400">⚠️ BLĐ bất mãn vì chuỗi ${gameState.losingStreak} trận không thắng!</span>`);
                    }
                }
            }

            // Update form for starters
            gameState.squad.filter(p => p.isStarting).forEach(p => {
                if (!p.form) p.form = [];
                p.form.push(resultLetter);
                if (p.form.length > 5) p.form.shift();
            });

            // Season stats
            if (!gameState.seasonStats) gameState.seasonStats = { goals: 0, cleanSheets: 0, biggestWin: 0 };
            gameState.seasonStats.goals += hs;
            if (as_ === 0) {
                gameState.seasonStats.cleanSheets++;
                if (gameState.seasonStats.cleanSheets >= 5) unlockAchievement('clean_sheet_5');
            }
            if (hs >= 10) unlockAchievement('score_10');
            if (hs - as_ > (gameState.seasonStats.biggestWin || 0)) gameState.seasonStats.biggestWin = hs - as_;

            // Player development weekly
            developPlayers();

            // Demand to start / contract niggle
            gameState.squad.forEach(p => {
                if ((p.happiness || 70) < 40 && p.personality === 'Nổi loạn' && Math.random() < 0.15) {
                    addCommentary(`📢 ${p.name} yêu cầu được ra sân thường xuyên hơn!`);
                }
            });

            simulateOtherMatches();
            gameState.recentResults.push({
                matchDay: gameState.currentMatchDay,
                opponentName: matchSimState.opponent.name,
                homeScore: hs,
                awayScore: as_
            });
            gameState.currentMatchDay++;
            saveGame();

            // Check season end
            if (gameState.currentMatchDay > gameState.totalMatchDays) {
                setTimeout(() => showSeasonEnd(), 800);
            }
        }

        function showSeasonEnd() {
            const modal = document.getElementById('season-end-modal');
            if (!modal) return;
            // sort standings
            gameState.standings.sort((a,b) => {
                if (b.pts !== a.pts) return b.pts - a.pts;
                return (b.gf - b.ga) - (a.gf - a.ga);
            });
            const rank = gameState.standings.findIndex(s => s.isPlayer) + 1;
            const me = gameState.standings.find(s => s.isPlayer);
            document.getElementById('season-end-year').innerText = `Mùa ${gameState.seasonYear}/${(gameState.seasonYear+1).toString().slice(2)} — Hạng ${rank}/${gameState.standings.length}`;

            let html = '';
            if (rank === 1) {
                html += `<div class="p-4 bg-amber-500/20 border border-amber-400/40 rounded-xl text-amber-300 font-black text-center text-lg">🥇 VÔ ĐỊCH GIẢI ĐẤU!</div>`;
                unlockAchievement('title');
                gameState.managerRep = Math.min(100, gameState.managerRep + 15);
                gameState.boardConfidence = Math.min(100, gameState.boardConfidence + 20);
            } else if (rank <= 3) {
                html += `<div class="p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-300 font-bold text-center">🥈 Top 3 — Xuất sắc!</div>`;
                unlockAchievement('top3');
                gameState.managerRep = Math.min(100, gameState.managerRep + 8);
            } else if (rank >= gameState.standings.length - 1) {
                html += `<div class="p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-300 font-bold text-center">⚠️ Vùng nguy hiểm / Xuống hạng</div>`;
                gameState.boardConfidence = Math.max(20, gameState.boardConfidence - 15);
            } else {
                html += `<div class="p-3 bg-slate-800 rounded-xl text-slate-300 text-center">Kết thúc mùa ở hạng ${rank}</div>`;
                unlockAchievement('survive');
            }

            const topScorer = [...gameState.squad].sort((a,b) => b.goals - a.goals)[0];
            html += `<div class="grid grid-cols-2 gap-2 mt-3">
                <div class="bg-slate-950 p-3 rounded-xl"><div class="text-[10px] text-slate-500">Điểm</div><div class="font-black text-amber-400 text-xl">${me ? me.pts : 0}</div></div>
                <div class="bg-slate-950 p-3 rounded-xl"><div class="text-[10px] text-slate-500">Hiệu số</div><div class="font-black text-slate-200 text-xl">${me ? (me.gf-me.ga) : 0}</div></div>
                <div class="bg-slate-950 p-3 rounded-xl"><div class="text-[10px] text-slate-500">Vua phá lưới CLB</div><div class="font-bold text-emerald-400">${topScorer ? topScorer.name + ' ('+topScorer.goals+')' : '-'}</div></div>
                <div class="bg-slate-950 p-3 rounded-xl"><div class="text-[10px] text-slate-500">Thành tựu</div><div class="font-bold text-amber-300">${(gameState.achievements||[]).length} / ${ACHIEVEMENT_DEFS.length}</div></div>
            </div>`;

            // Board objective check
            const obj = gameState.boardObjective || 'TOP_HALF';
            let objOk = false;
            if (obj === 'TITLE') objOk = rank === 1;
            else if (obj === 'TOP_3') objOk = rank <= 3;
            else if (obj === 'TOP_HALF') objOk = rank <= Math.ceil(gameState.standings.length / 2);
            else objOk = rank < gameState.standings.length - 1;
            html += `<div class="mt-3 p-3 rounded-xl border ${objOk ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-red-500/40 bg-red-950/30 text-red-300'}">
                Mục tiêu BLĐ: <strong>${obj.replace('_',' ')}</strong> — ${objOk ? '✅ Hoàn thành' : '❌ Không đạt'}
            </div>`;

            document.getElementById('season-end-content').innerHTML = html;
            modal.classList.remove('hidden');
        }

        function startNewSeason() {
            document.getElementById('season-end-modal').classList.add('hidden');
            gameState.seasonYear++;
            gameState.currentMatchDay = 1;
            gameState.losingStreak = 0;
            gameState.winningStreak = 0;
            gameState.seasonStats = { goals: 0, cleanSheets: 0, biggestWin: 0 };
            gameState.recentResults = [];
            // reset standings
            gameState.standings.forEach(s => {
                s.pts = 0; s.p = 0; s.w = 0; s.d = 0; s.l = 0; s.gf = 0; s.ga = 0;
            });
            // reset player season stats, contracts
            gameState.squad.forEach(p => {
                p.goals = 0; p.assists = 0; p.yellowCards = 0;
                p.form = [];
                p.contractYears = Math.max(0, (p.contractYears || 1) - 1);
                if (p.contractYears === 0) {
                    p.happiness = Math.max(40, (p.happiness || 70) - 10);
                }
            });
            // wonderkid chance from academy
            if (Math.random() < 0.15 + (gameState.facilities.academy.level || 1) * 0.08) {
                const pos = ['ST','CAM','CM','CB','RW'][Math.floor(Math.random()*5)];
                const pot = 82 + Math.floor(Math.random()*12);
                const wk = {
                    id: Date.now(), name: getRandomName(), pos, rating: 62 + Math.floor(Math.random()*8),
                    potential: pot, age: 16, wage: 600, value: 500000,
                    isStarting: false, stamina: 100, goals: 0, assists: 0, yellowCards: 0,
                    personality: 'Tham vọng', form: [], injuryWeeks: 0, happiness: 85, contractYears: 3, isReal: false
                };
                gameState.youthAcademy.push(wk);
                if (pot >= 85) unlockAchievement('wonderkid');
                alert(`🌟 Học viện phát hiện Wonderkid: ${wk.name} (${pos}, POT ${pot})!`);
            }
            // refresh transfer market
            gameState.transferMarket = generateTransferMarket();
            // board objective based on club strength
            const clubOvr = gameState.squad.filter(p=>p.isStarting).reduce((s,p)=>s+p.rating,0)/11;
            if (clubOvr >= 82) gameState.boardObjective = 'TITLE';
            else if (clubOvr >= 76) gameState.boardObjective = 'TOP_3';
            else if (clubOvr >= 70) gameState.boardObjective = 'TOP_HALF';
            else gameState.boardObjective = 'AVOID_RELEGATION';

            saveGame();
            updateUI();
            alert(`Mùa ${gameState.seasonYear}/${(gameState.seasonYear+1).toString().slice(2)} bắt đầu! Mục tiêu BLĐ: ${gameState.boardObjective.replace('_',' ')}`);
        }

        function simulateOtherMatches() {
            const aiTeams = gameState.standings.filter(s => !s.isPlayer);
            for (let i = 0; i < aiTeams.length - 1; i += 2) {
                const t1 = aiTeams[i], t2 = aiTeams[i+1];
                if (!t1 || !t2) continue;
                const g1 = Math.floor(Math.random() * 4);
                const g2 = Math.floor(Math.random() * 4);
                t1.p++; t2.p++;
                t1.gf += g1; t1.ga += g2;
                t2.gf += g2; t2.ga += g1;
                if (g1 > g2) { t1.pts += 3; t1.w++; t2.l++; }
                else if (g1 === g2) { t1.pts += 1; t2.pts += 1; t1.d++; t2.d++; }
                else { t2.pts += 3; t2.w++; t1.l++; }
            }
        }

        function closeMatchModal() {
            document.getElementById('match-modal').classList.add('hidden');
            closeSubPanel();
            updateUI();
            if (gameState.currentMatchDay > gameState.totalMatchDays) {
                showSeasonEnd();
            }
        }

        // Hook save button
        window.saveGame = saveGameManual;
        window.resetGamePrompt = resetGamePrompt;

        // ==================== AUTH + BOOT ====================
        window.fmLogout = async function() {
            await logout();
            location.reload();
        };

        window.chooseClubMode = function(mode) {
            document.getElementById('club-mode-modal').classList.add('hidden');
            if (mode === 'existing') {
                document.getElementById('club-select-modal').classList.remove('hidden');
                // show league step
                const stepLeague = document.getElementById('step-league');
                const stepClub = document.getElementById('step-club');
                const stepManager = document.getElementById('step-manager');
                if (stepLeague) stepLeague.classList.remove('hidden');
                if (stepClub) stepClub.classList.add('hidden');
                if (stepManager) stepManager.classList.add('hidden');
            } else {
                document.getElementById('custom-club-modal').classList.remove('hidden');
            }
        };

        window.submitCustomClub = async function() {
            const name = (document.getElementById('custom-club-name').value || '').trim();
            const badge = (document.getElementById('custom-club-badge').value || 'FC').trim().toUpperCase().slice(0, 4);
            const ovr = parseInt(document.getElementById('custom-club-ovr').value, 10) || 70;
            const stadium = document.getElementById('custom-club-stadium').value || 'Sân nhà';
            const budget = parseInt(document.getElementById('custom-club-budget').value, 10) || 25000000;
            const logo = (document.getElementById('custom-club-logo').value || '').trim() || null;
            const err = document.getElementById('custom-club-error');
            if (!name) {
                err.textContent = 'Nhập tên CLB';
                err.classList.remove('hidden');
                return;
            }
            const club = {
                id: 'custom_' + (getCurrentUser()?.uid || Date.now()),
                name, short: name, badge, ovr, budget, stadium, capacity: 20000, logo,
                keyPlayers: []
            };
            try {
                await saveCustomClub(club);
                // start game with this club
                selectedLeagueId = 'custom';
                selectedClubId = club.id;
                // inject into a temporary path
                window.__customClub = club;
                document.getElementById('custom-club-modal').classList.add('hidden');
                // skip league select — go to manager name then start
                const mgr = getCurrentUser()?.displayName || 'HLV';
                document.getElementById('input-manager-name') && (document.getElementById('input-manager-name').value = mgr);
                // Direct start
                startWithClub(club, 'custom');
            } catch (e) {
                err.textContent = e.message || 'Lỗi tạo CLB';
                err.classList.remove('hidden');
            }
        };

        function startWithClub(club, leagueId) {
            const managerName = (document.getElementById('input-manager-name')?.value || getCurrentUser()?.displayName || 'HLV').trim();
            gameState.managerName = managerName;
            gameState.clubName = club.name;
            gameState.clubId = club.id;
            gameState.clubBadge = club.badge;
            gameState.clubLogo = club.logo || null;
            gameState.leagueId = leagueId;
            gameState.budget = club.budget;
            gameState.facilities.stadium.name = club.stadium || 'Sân nhà';
            gameState.facilities.stadium.capacity = club.capacity || 20000;
            gameState.squad = generateSquadForClub(club);
            gameState.penaltyTakerId = gameState.squad.find(p => p.isStarting && ['ST','CAM','CM'].includes(p.pos))?.id || gameState.squad[0]?.id;

            // opponents from same league if possible
            let allClubs = [];
            if (leagueId === 'custom') {
                // use V.League as competition for custom clubs
                allClubs = getClubsForLeague('vleague1');
                gameState.leagueId = 'vleague1';
            } else {
                allClubs = getClubsForLeague(leagueId);
            }
            gameState.opponents = allClubs.filter(c => c.id !== club.id).map((c, idx) => ({
                id: idx + 1, name: c.name, badge: c.badge, logo: c.logo || null,
                ovr: c.ovr, att: c.ovr + Math.floor(Math.random()*3)-1, def: c.ovr + Math.floor(Math.random()*3)-1
            }));
            gameState.standings = [
                { name: club.name, isPlayer: true, pts: 0, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 },
                ...gameState.opponents.map(o => ({ name: o.name, isPlayer: false, pts: 0, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }))
            ];
            gameState.currentMatchDay = 1;
            gameState.totalMatchDays = Math.max(10, (gameState.standings.length - 1) * 2);
            gameState.recentResults = [];

            updateUserProfile({
                clubMode: leagueId === 'custom' ? 'custom' : 'existing',
                clubId: club.id,
                displayName: managerName
            }).catch(() => {});

            document.getElementById('club-select-modal')?.classList.add('hidden');
            document.getElementById('club-mode-modal')?.classList.add('hidden');
            document.getElementById('custom-club-modal')?.classList.add('hidden');
            document.getElementById('login-modal')?.classList.add('hidden');

            saveGame();
            updateUI();
            showUserChrome();
        }

        function showUserChrome() {
            const u = getCurrentUser();
            if (!u) return;
            const badge = document.getElementById('user-email-badge');
            if (badge) { badge.textContent = u.email; badge.classList.remove('hidden'); }
            if (isAdmin()) {
                document.getElementById('admin-nav-link')?.classList.remove('hidden');
                document.getElementById('admin-quick-link')?.classList.remove('hidden');
            }
        }

        // Patch confirmStartGame to use startWithClub
        const _origConfirm = typeof confirmStartGame === 'function' ? confirmStartGame : null;

        async function bootApp() {
            await initAuth();
            let settings = {};
            try { settings = await adminGetSettings(); } catch (_) {}

            if (settings.announcement) {
                const el = document.getElementById('server-announcement');
                if (el) {
                    el.textContent = settings.announcement;
                    el.classList.remove('hidden');
                }
            }

            const user = getCurrentUser();
            const loginModal = document.getElementById('login-modal');
            const clubSelect = document.getElementById('club-select-modal');
            if (clubSelect) clubSelect.classList.add('hidden');

            document.getElementById('login-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const err = document.getElementById('login-error');
                err.classList.add('hidden');
                try {
                    const email = document.getElementById('login-email').value;
                    const password = document.getElementById('login-password').value;
                    const u = await login(email, password);
                    if (settings.maintenanceMode && u.role !== 'admin') {
                        throw new Error('Server đang bảo trì. Chỉ admin được vào.');
                    }
                    loginModal?.classList.add('hidden');
                    afterLogin(u, settings);
                } catch (ex) {
                    err.textContent = ex.message || 'Đăng nhập thất bại';
                    err.classList.remove('hidden');
                }
            });

            if (user) {
                if (settings.maintenanceMode && user.role !== 'admin') {
                    loginModal?.classList.remove('hidden');
                    document.getElementById('login-error').textContent = 'Server bảo trì';
                    document.getElementById('login-error').classList.remove('hidden');
                    return;
                }
                loginModal?.classList.add('hidden');
                afterLogin(user, settings);
            } else {
                loginModal?.classList.remove('hidden');
            }
        }

        async function afterLogin(user, settings) {
            showUserChrome();
            document.getElementById('welcome-name').textContent = user.displayName || user.email?.split('@')[0] || 'HLV';
            if (isAdmin()) document.getElementById('admin-quick-link')?.classList.remove('hidden');

            // Try cloud save
            const cloud = await loadGameCloud();
            if (cloud && cloud.clubName) {
                Object.assign(gameState, cloud);
                document.getElementById('club-mode-modal')?.classList.add('hidden');
                document.getElementById('club-select-modal')?.classList.add('hidden');
                updateUI();
                return;
            }
            // local save?
            try {
                const local = localStorage.getItem('fm_game_save_v2');
                if (local) {
                    const data = JSON.parse(local);
                    if (data.clubName) {
                        Object.assign(gameState, data);
                        document.getElementById('club-mode-modal')?.classList.add('hidden');
                        document.getElementById('club-select-modal')?.classList.add('hidden');
                        updateUI();
                        return;
                    }
                }
            } catch (_) {}

            // Need club choice
            if (settings.allowCustomClubs === false) {
                document.getElementById('btn-custom-club')?.classList.add('opacity-40', 'pointer-events-none');
            }
            document.getElementById('club-mode-modal')?.classList.remove('hidden');
            // still init UI shells
            try { initGame(); } catch (_) {}
        }

        // Override confirmStartGame to also save profile
        function confirmStartGamePatched() {
            const club = getClubsForLeague(selectedLeagueId).find(c => c.id === selectedClubId);
            if (!club) return;
            startWithClub(club, selectedLeagueId);
        }
        window.confirmStartGame = confirmStartGamePatched;

        // Hook save to cloud
        const _save = typeof saveGame === 'function' ? saveGame : null;
        if (typeof saveGameManual === 'function') {
            const _sm = saveGameManual;
            window.saveGameManual = function() {
                _sm();
                saveGameCloud(gameState).catch(() => {});
            };
        }

        window.onload = function() {
            bootApp();
        };


    

// Expose functions for HTML onclick handlers
try {
  window.switchTab = switchTab;
  window.openMatchModal = openMatchModal;
  window.closeMatchModal = closeMatchModal;
  window.toggleMatchPause = toggleMatchPause;
  window.toggleMatchSpeed = toggleMatchSpeed;
  window.setMidMatchMentality = setMidMatchMentality;
  window.changeFormation = changeFormation;
  window.updateTacticsStyle = updateTacticsStyle;
  window.swapPlayerStartingStatus = swapPlayerStartingStatus;
  window.filterTransferMarket = filterTransferMarket;
  window.buyPlayer = buyPlayer;
  window.scoutNewYouthPlayer = scoutNewYouthPlayer;
  window.signYouthPlayer = signYouthPlayer;
  window.switchTransferSubtab = switchTransferSubtab;
  window.upgradeFacility = upgradeFacility;
  window.selectLeague = selectLeague;
  window.selectClub = selectClub;
  window.backToLeagueStep = backToLeagueStep;
  window.confirmStartGame = typeof confirmStartGamePatched === 'function' ? confirmStartGamePatched : confirmStartGame;
  window.openSubPanel = openSubPanel;
  window.closeSubPanel = closeSubPanel;
  window.selectSubOut = selectSubOut;
  window.selectSubIn = selectSubIn;
  window.startNewSeason = startNewSeason;
  window.saveGame = typeof saveGameManual !== 'undefined' ? saveGameManual : saveGame;
  window.resetGamePrompt = resetGamePrompt;
} catch(e) { console.warn('expose', e); }
