
import { LEAGUES } from '../data/leagues.js';
import { VLEAGUE_CLUBS } from '../data/vleague.js';
import { WORLD_CLUBS } from '../data/world.js';
import { NATIONAL_TEAMS } from '../data/national.js';
import {
  initAuth, login, logout, getCurrentUser, isAdmin,
  updateUserProfile, saveGameCloud, loadGameCloud,
  saveCustomClub, adminGetSettings, clearPendingGifts
} from './auth.js';
window.getCurrentUser = getCurrentUser;
window.fmClearPendingGifts = clearPendingGifts;

export function getClubsForLeague(leagueId) {
    if (leagueId === 'vleague1') return VLEAGUE_CLUBS;
    if (leagueId === 'national') return NATIONAL_TEAMS;
    return WORLD_CLUBS[leagueId] || [];
}

// Make available on window for inline onclick handlers
window.getClubsForLeague = getClubsForLeague;

const MAX_SQUAD_SIZE = 100;
const MIN_SQUAD_SIZE = 15;
window.MAX_SQUAD_SIZE = MAX_SQUAD_SIZE;

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
        function makePlayerFromData(src, id) {
            const rating = src.rating || 70;
            const age = src.age || 25;
            return {
                id: id,
                name: src.name,
                pos: src.pos || 'CM',
                rating: rating,
                age: age,
                birthYear: src.birthYear || (2026 - age),
                nationality: src.nation || src.nationality || 'Unknown',
                nation: src.nation || src.nationality || 'Unknown',
                image: src.image || (src.soccerwikiId || src.pid ? ('https://cdn.soccerwiki.org/images/player/' + (src.soccerwikiId || src.pid) + '.png') : null),
                soccerwikiId: src.soccerwikiId || src.pid || null,
                wage: src.wage || rating * 1400,
                value: src.value || rating * 180000,
                isStarting: false,
                stamina: 100,
                goals: 0, assists: 0, yellowCards: 0,
                isReal: src.isReal !== false,
                personality: PERSONALITIES[Math.floor(Math.random()*PERSONALITIES.length)],
                form: [],
                injuryWeeks: 0,
                happiness: 75 + Math.floor(Math.random()*20),
                contractYears: 1 + Math.floor(Math.random()*3),
                potential: src.potential || Math.min(99, rating + Math.floor(Math.random()*6) + 2)
            };
        }

        function generateSquadForClub(club) {
            const positions = [
                { pos: 'GK', count: 3 }, { pos: 'CB', count: 4 }, { pos: 'LB', count: 2 }, { pos: 'RB', count: 2 },
                { pos: 'CDM', count: 2 }, { pos: 'CM', count: 4 }, { pos: 'CAM', count: 2 },
                { pos: 'RW', count: 2 }, { pos: 'LW', count: 2 }, { pos: 'ST', count: 3 }
            ];
            let squad = [];
            let idCounter = 100;
            const usedNames = new Set();
            const baseOvr = club.ovr || 70;

            const realList = (club.players && club.players.length)
                ? club.players
                : (club.keyPlayers || []);

            realList.forEach(kp => {
                if (!kp || !kp.name || usedNames.has(kp.name)) return;
                usedNames.add(kp.name);
                squad.push(makePlayerFromData(kp, idCounter++));
            });

            positions.forEach(item => {
                const existing = squad.filter(p => p.pos === item.pos).length;
                for (let i = existing; i < item.count; i++) {
                    let name;
                    do { name = getRandomName(); } while (usedNames.has(name));
                    usedNames.add(name);
                    const isStarterLevel = i === 0;
                    const rating = isStarterLevel
                        ? Math.min(88, baseOvr + Math.floor(Math.random() * 4) - 1)
                        : Math.max(58, baseOvr - 10 + Math.floor(Math.random() * 10));
                    const age = Math.floor(Math.random() * 14) + 17;
                    squad.push(makePlayerFromData({
                        name, pos: item.pos, rating, age, isReal: false,
                        wage: rating * 1100, value: rating * 140000,
                        potential: Math.min(92, rating + (age < 23 ? Math.floor(Math.random()*12)+4 : Math.floor(Math.random()*5)))
                    }, idCounter++));
                }
            });

            autoPickStartingXI(squad, gameState.formation || "4-3-3");
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
                ],

                "4-1-4-1": [
                    { pos: 'GK', top: '88%', left: '50%' },
                    { pos: 'LB', top: '68%', left: '12%' }, { pos: 'CB', top: '72%', left: '35%' },
                    { pos: 'CB', top: '72%', left: '65%' }, { pos: 'RB', top: '68%', left: '88%' },
                    { pos: 'CDM', top: '55%', left: '50%' },
                    { pos: 'LM', top: '40%', left: '15%' }, { pos: 'CM', top: '42%', left: '38%' },
                    { pos: 'CM', top: '42%', left: '62%' }, { pos: 'RM', top: '40%', left: '85%' },
                    { pos: 'ST', top: '16%', left: '50%' }
                ],
                "4-3-2-1": [
                    { pos: 'GK', top: '88%', left: '50%' },
                    { pos: 'LB', top: '68%', left: '12%' }, { pos: 'CB', top: '72%', left: '35%' },
                    { pos: 'CB', top: '72%', left: '65%' }, { pos: 'RB', top: '68%', left: '88%' },
                    { pos: 'CM', top: '52%', left: '25%' }, { pos: 'CM', top: '55%', left: '50%' },
                    { pos: 'CM', top: '52%', left: '75%' },
                    { pos: 'CAM', top: '32%', left: '35%' }, { pos: 'CAM', top: '32%', left: '65%' },
                    { pos: 'ST', top: '14%', left: '50%' }
                ],
                "3-4-3": [
                    { pos: 'GK', top: '88%', left: '50%' },
                    { pos: 'CB', top: '72%', left: '25%' }, { pos: 'CB', top: '75%', left: '50%' },
                    { pos: 'CB', top: '72%', left: '75%' },
                    { pos: 'LM', top: '48%', left: '12%' }, { pos: 'CM', top: '50%', left: '38%' },
                    { pos: 'CM', top: '50%', left: '62%' }, { pos: 'RM', top: '48%', left: '88%' },
                    { pos: 'LW', top: '20%', left: '20%' }, { pos: 'ST', top: '15%', left: '50%' },
                    { pos: 'RW', top: '20%', left: '80%' }
                ],
                "4-5-1": [
                    { pos: 'GK', top: '88%', left: '50%' },
                    { pos: 'LB', top: '68%', left: '12%' }, { pos: 'CB', top: '72%', left: '35%' },
                    { pos: 'CB', top: '72%', left: '65%' }, { pos: 'RB', top: '68%', left: '88%' },
                    { pos: 'LM', top: '42%', left: '12%' }, { pos: 'CM', top: '48%', left: '32%' },
                    { pos: 'CDM', top: '52%', left: '50%' }, { pos: 'CM', top: '48%', left: '68%' },
                    { pos: 'RM', top: '42%', left: '88%' },
                    { pos: 'ST', top: '16%', left: '50%' }
                ],
                "3-4-2-1": [
                    { pos: 'GK', top: '88%', left: '50%' },
                    { pos: 'CB', top: '72%', left: '25%' }, { pos: 'CB', top: '75%', left: '50%' },
                    { pos: 'CB', top: '72%', left: '75%' },
                    { pos: 'LM', top: '50%', left: '12%' }, { pos: 'CM', top: '52%', left: '38%' },
                    { pos: 'CM', top: '52%', left: '62%' }, { pos: 'RM', top: '50%', left: '88%' },
                    { pos: 'CAM', top: '30%', left: '35%' }, { pos: 'CAM', top: '30%', left: '65%' },
                    { pos: 'ST', top: '14%', left: '50%' }
                ],

            };
            if (formation === "FREE") return maps["4-3-3"];
            return maps[formation] || maps["4-3-3"];
        }


        function ensureGameExtras() {
            if (!gameState.cardInventory) gameState.cardInventory = [];
            // Luôn đồng bộ tỉ lệ ghép từ admin (không dùng bản cũ trong save)
            try { syncMergeRatesFromAdmin(); } catch (_) {
                if (!gameState.mergeRates) gameState.mergeRates = defaultMergeRates();
            }
            // Backfill ảnh cho squad + kho thẻ (save cũ thiếu image)
            try { backfillAllImages(false); } catch (e) { console.warn(e); }
            if (!gameState.squadPresets) {
                gameState.squadPresets = { A: null, B: null, C: null, D: null };
            }
            if (!gameState.activePreset) gameState.activePreset = 'A';
            if (!gameState.freePositions) gameState.freePositions = {};
            // matchdayRole: start | bench | reserve
            if (gameState.squad && gameState.squad.length) {
                let benchCount = 0;
                gameState.squad.forEach(p => {
                    if (p.isStarting) {
                        p.matchdayRole = 'start';
                    } else if (p.matchdayRole === 'bench') {
                        benchCount++;
                    } else if (!p.matchdayRole) {
                        p.matchdayRole = 'reserve';
                    }
                });
                // Auto-fill bench up to 7 from highest rated reserves if empty
                if (benchCount === 0) {
                    gameState.squad
                        .filter(p => !p.isStarting && p.injuryWeeks === 0)
                        .sort((a,b) => b.rating - a.rating)
                        .slice(0, 7)
                        .forEach(p => { p.matchdayRole = 'bench'; });
                    gameState.squad.forEach(p => {
                        if (!p.isStarting && p.matchdayRole !== 'bench') p.matchdayRole = 'reserve';
                    });
                }
            }
        }

        function snapshotSquadPreset() {
            return {
                formation: gameState.formation,
                tacticStyle: gameState.tacticStyle,
                players: gameState.squad.map(p => ({
                    id: p.id,
                    isStarting: !!p.isStarting,
                    slotIndex: typeof p.slotIndex === 'number' ? p.slotIndex : null,
                    matchdayRole: p.matchdayRole || (p.isStarting ? 'start' : 'reserve'),
                    freePos: gameState.freePositions && gameState.freePositions[p.id] ? gameState.freePositions[p.id] : null
                }))
            };
        }

        function applySquadPreset(data) {
            if (!data) return;
            if (data.formation) gameState.formation = data.formation;
            if (data.tacticStyle) gameState.tacticStyle = data.tacticStyle;
            const byId = {};
            (data.players || []).forEach(x => { byId[x.id] = x; });
            gameState.squad.forEach(p => {
                const s = byId[p.id];
                if (!s) {
                    p.isStarting = false;
                    p.slotIndex = null;
                    p.matchdayRole = 'reserve';
                    return;
                }
                p.isStarting = !!s.isStarting;
                p.slotIndex = s.slotIndex;
                p.matchdayRole = s.matchdayRole || (s.isStarting ? 'start' : 'reserve');
                if (s.freePos) {
                    if (!gameState.freePositions) gameState.freePositions = {};
                    gameState.freePositions[p.id] = s.freePos;
                }
            });
        }

        function saveCurrentSquadPreset() {
            ensureGameExtras();
            const key = gameState.activePreset || 'A';
            gameState.squadPresets[key] = snapshotSquadPreset();
            saveGame();
            alert('Đã lưu đội hình ' + key + (key === 'A' ? ' (Chính)' : key === 'B' ? ' (Phụ)' : ''));
            updatePresetButtons();
        }

        function loadSquadPreset(key) {
            ensureGameExtras();
            // auto-save current before switch
            const prev = gameState.activePreset || 'A';
            if (prev && prev !== key) {
                gameState.squadPresets[prev] = snapshotSquadPreset();
            }
            gameState.activePreset = key;
            const data = gameState.squadPresets[key];
            if (data) {
                applySquadPreset(data);
            } else {
                // empty preset: keep current but mark active
            }
            saveGame();
            updatePresetButtons();
            renderTacticsTab();
            updateUI();
        }

        function updatePresetButtons() {
            const active = (gameState && gameState.activePreset) || 'A';
            document.querySelectorAll('.squad-preset-btn').forEach(btn => {
                const k = btn.getAttribute('data-preset');
                const has = gameState.squadPresets && gameState.squadPresets[k];
                if (k === active) {
                    btn.className = 'squad-preset-btn px-2 py-1 rounded-lg text-[11px] font-black border border-emerald-500/40 bg-emerald-500/20 text-emerald-300';
                } else if (has) {
                    btn.className = 'squad-preset-btn px-2 py-1 rounded-lg text-[11px] font-black border border-sky-500/30 bg-sky-500/10 text-sky-300';
                } else {
                    btn.className = 'squad-preset-btn px-2 py-1 rounded-lg text-[11px] font-black border border-slate-600 bg-slate-800 text-slate-300';
                }
            });
        }

        function setMatchdayRole(playerId, role) {
            const p = gameState.squad.find(x => x.id === playerId);
            if (!p) return;
            if (role === 'list_market') {
                listPlayerOnMarket(playerId);
                return;
            }
            if (role === 'sell_now') {
                sellPlayer(playerId);
                return;
            }
            if (role === 'release') {
                releasePlayer(playerId);
                return;
            }
            if (role === 'start') {
                if (!p.isStarting) {
                    const starters = gameState.squad.filter(x => x.isStarting).length;
                    if (starters >= 11) {
                        alert('Đã đủ 11 người ra sân. Hãy gỡ 1 người trước.');
                        renderTacticsTab();
                        return;
                    }
                    p.isStarting = true;
                    p.matchdayRole = 'start';
                }
            } else if (role === 'bench') {
                const benches = gameState.squad.filter(x => !x.isStarting && x.matchdayRole === 'bench').length;
                if (p.matchdayRole !== 'bench' && benches >= 7) {
                    alert('Tối đa 7 cầu thủ dự bị đăng ký trận!');
                    renderTacticsTab();
                    return;
                }
                p.isStarting = false;
                p.slotIndex = null;
                p.matchdayRole = 'bench';
            } else {
                p.isStarting = false;
                p.slotIndex = null;
                p.matchdayRole = 'reserve';
            }
            saveGame();
            renderTacticsTab();
            updateUI();
        }

        function releasePlayer(playerId) {
            const idx = gameState.squad.findIndex(p => p.id === playerId);
            if (idx === -1) return;
            const player = gameState.squad[idx];
            if (gameState.squad.length <= MIN_SQUAD_SIZE) {
                alert('Đội cần tối thiểu ' + MIN_SQUAD_SIZE + ' cầu thủ. Không thể sa thải thêm.');
                renderTacticsTab();
                return;
            }
            if (!confirm('Sa thải ' + player.name + '? (Không nhận tiền, rời CLB)')) {
                renderTacticsTab();
                return;
            }
            gameState.squad.splice(idx, 1);
            if (typeof selectedTacticsPlayerId !== 'undefined' && selectedTacticsPlayerId === playerId) selectedTacticsPlayerId = null;
            saveGame();
            alert('Đã sa thải ' + player.name);
            renderTacticsTab();
            updateUI();
        }

        function listPlayerOnMarket(playerId) {
            ensureTransferMarket();
            const idx = gameState.squad.findIndex(p => p.id === playerId);
            if (idx === -1) return;
            const player = gameState.squad[idx];
            if (gameState.squad.length <= MIN_SQUAD_SIZE) {
                alert('Đội cần tối thiểu ' + MIN_SQUAD_SIZE + ' cầu thủ. Không thể đăng bán thêm.');
                renderTacticsTab();
                return;
            }
            const ask = Math.round((player.value || player.rating * 150000) * 0.85);
            if (!confirm('Đăng bán ' + player.name + ' lên thị trường với giá $' + (ask/1e6).toFixed(2) + 'M?\nCầu thủ sẽ rời đội hình ngay.')) {
                renderTacticsTab();
                return;
            }
            gameState.squad.splice(idx, 1);
            if (typeof selectedTacticsPlayerId !== 'undefined' && selectedTacticsPlayerId === playerId) selectedTacticsPlayerId = null;
            gameState.transferMarket.unshift({
                id: 90000 + Math.floor(Math.random() * 9000),
                name: player.name,
                pos: player.pos,
                rating: player.rating,
                age: player.age,
                image: player.image || null,
                value: ask,
                wage: player.wage || player.rating * 1500,
                clubFrom: gameState.clubName || 'Your Club',
                leagueFrom: gameState.leagueId || 'listed',
                isReal: !!player.isReal,
                listedByMe: true,
                cardOnly: false
            });
            saveGame();
            alert('Đã đăng bán ' + player.name + ' trên thị trường.');
            renderTacticsTab();
            updateUI();
            try { filterTransferMarket(); } catch (_) {}
        }

        // ===== CARD SYSTEM =====
        function cardKey(name, plus) {
            return String(name).toLowerCase() + '|+' + (plus || 0);
        }

        function getCardPlusForPlayer(playerName) {
            ensureGameExtras();
            const inv = gameState.cardInventory || [];
            let best = 0;
            inv.forEach(c => {
                if (c.name === playerName && (c.plus || 0) > best) best = c.plus || 0;
            });
            return best;
        }


        function nationFlagEmoji(nation) {
            if (!nation || nation === 'Unknown') return '';
            const map = {
                'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Germany': '🇩🇪', 'France': '🇫🇷', 'Spain': '🇪🇸', 'Italy': '🇮🇹',
                'Portugal': '🇵🇹', 'Brazil': '🇧🇷', 'Argentina': '🇦🇷', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪',
                'Croatia': '🇭🇷', 'Uruguay': '🇺🇾', 'Norway': '🇳🇴', 'Sweden': '🇸🇪', 'Denmark': '🇩🇰',
                'Poland': '🇵🇱', 'Switzerland': '🇨🇭', 'Austria': '🇦🇹', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
                'Japan': '🇯🇵', 'Korea': '🇰🇷', 'South Korea': '🇰🇷', 'Nigeria': '🇳🇬', 'Senegal': '🇸🇳',
                'Morocco': '🇲🇦', 'Egypt': '🇪🇬', 'Ghana': '🇬🇭', 'Ivory Coast': '🇨🇮', 'Cameroon': '🇨🇲',
                'USA': '🇺🇸', 'Mexico': '🇲🇽', 'Canada': '🇨🇦', 'Colombia': '🇨🇴', 'Chile': '🇨🇱',
                'Turkey': '🇹🇷', 'Russia': '🇷🇺', 'Ukraine': '🇺🇦', 'Serbia': '🇷🇸', 'Czech': '🇨🇿',
                'Vietnam': '🇻🇳', 'Việt Nam': '🇻🇳', 'Australia': '🇦🇺', 'Algeria': '🇩🇿', 'Tunisia': '🇹🇳'
            };
            if (map[nation]) return map[nation];
            // try partial
            for (const k of Object.keys(map)) {
                if (nation.indexOf(k) >= 0 || k.indexOf(nation) >= 0) return map[k];
            }
            return '🏳️';
        }

        function fo4Tier(rating) {
            const r = rating || 70;
            if (r >= 90) return 'tier-icon';
            if (r >= 80) return 'tier-gold';
            if (r >= 70) return 'tier-silver';
            return 'tier-bronze';
        }

        /** HTML khung thẻ kiểu FO4 / ICON */
        function renderFo4CardFace(player, opts) {
            opts = opts || {};
            const rating = opts.rating != null ? opts.rating : (player.rating || 70);
            const pos = player.pos || 'CM';
            const name = (player.name || 'Unknown').replace(/\s*\[Thẻ.*?\]\s*/g, '').trim();
            const shortName = name.length > 16 ? name.split(' ').slice(-2).join(' ') : name;
            const img = (typeof resolvePlayerImage === 'function' ? resolvePlayerImage(player) : player.image) || player.image;
            const nation = player.nationality || player.nation || '';
            const flag = nationFlagEmoji(nation);
            const plus = opts.plus != null ? opts.plus : 0;
            const tier = fo4Tier(rating);
            const label = opts.label || (rating >= 90 ? 'ICON' : (rating >= 80 ? 'GOLD' : ''));
            const by = player.birthYear || (player.age ? (2026 - player.age) : '');
            const photo = img
                ? '<img class="fo4-photo" src="' + img + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'flex\'">'
                  + '<div class="fo4-photo-placeholder" style="display:none">' + rating + '</div>'
                : '<div class="fo4-photo-placeholder">' + rating + '</div>';
            return '<div class="fo4-card ' + tier + (opts.selected ? ' selected' : '') + (opts.mergeable ? ' mergeable' : '') + '">'
                + (label ? '<div class="fo4-badge-top">' + label + '</div>' : '')
                + (plus > 0 ? '<div class="fo4-plus">+' + plus + '</div>' : '')
                + '<div class="fo4-inner">'
                + '<div class="fo4-top">'
                + '<div class="fo4-ovr-block"><div class="fo4-ovr">' + rating + '</div><div class="fo4-pos">' + pos + '</div></div>'
                + (flag ? '<div class="fo4-flag-fallback" title="' + nation + '">' + flag + '</div>' : '<div></div>')
                + '</div>'
                + '<div class="fo4-photo-wrap">' + photo + '</div>'
                + '<div class="fo4-bottom">'
                + '<div class="fo4-name" title="' + name + '">' + shortName + '</div>'
                + '<div class="fo4-meta">' + (player.age ? player.age + 't' : '') + (by ? ' · ' + by : '') + (nation && nation !== 'Unknown' ? ' · ' + nation : '') + '</div>'
                + '</div></div></div>';
        }

        let _playerImageIndex = null;

        function normalizePlayerName(name) {
            return String(name || '')
                .replace(/\s*\[Thẻ.*?\]\s*/g, '')
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
                .replace(/\s+/g, ' ').trim();
        }

        function buildPlayerImageIndex() {
            if (_playerImageIndex) return _playerImageIndex;
            const map = Object.create(null);
            try {
                const leagues = typeof WORLD_CLUBS !== 'undefined' ? WORLD_CLUBS : {};
                Object.keys(leagues).forEach(lid => {
                    (leagues[lid] || []).forEach(club => {
                        const pools = [];
                        if (Array.isArray(club.players)) pools.push(...club.players);
                        if (Array.isArray(club.keyPlayers)) pools.push(...club.keyPlayers);
                        pools.forEach(p => {
                            if (!p || !p.name) return;
                            const key = normalizePlayerName(p.name);
                            if (!key) return;
                            const img = p.image || (p.pid || p.soccerwikiId
                                ? ('https://cdn.soccerwiki.org/images/player/' + (p.pid || p.soccerwikiId) + '.png')
                                : null);
                            if (!img) return;
                            // keep higher rating if duplicate
                            if (!map[key] || (p.rating || 0) > (map[key].rating || 0)) {
                                map[key] = {
                                    image: img,
                                    pid: p.pid || p.soccerwikiId || null,
                                    soccerwikiId: p.soccerwikiId || p.pid || null,
                                    rating: p.rating || 0,
                                    nation: p.nation || p.nationality || null,
                                    birthYear: p.birthYear || null
                                };
                            }
                        });
                    });
                });
            } catch (e) { console.warn('buildPlayerImageIndex', e); }
            _playerImageIndex = map;
            return map;
        }

        function lookupPlayerMeta(name) {
            const map = buildPlayerImageIndex();
            const key = normalizePlayerName(name);
            if (!key) return null;
            if (map[key]) return map[key];
            // chỉ match họ khi index đã có surname map (O(1))
            if (!_playerSurnameIndex) {
                _playerSurnameIndex = Object.create(null);
                Object.keys(map).forEach(k => {
                    const parts = k.split(' ');
                    const last = parts[parts.length - 1];
                    if (!last || last.length < 3) return;
                    if (!_playerSurnameIndex[last]) _playerSurnameIndex[last] = [];
                    _playerSurnameIndex[last].push(k);
                });
            }
            const parts = key.split(' ');
            if (parts.length >= 2) {
                const last = parts[parts.length - 1];
                const hits = _playerSurnameIndex[last];
                if (hits && hits.length === 1) return map[hits[0]];
            }
            return null;
        }
        let _playerSurnameIndex = null;
        let _imagesBackfilled = false;

        function resolvePlayerImage(player) {
            if (!player) return null;
            if (player.image && String(player.image).indexOf('http') === 0) return player.image;
            const pid = player.soccerwikiId || player.pid;
            if (pid) return 'https://cdn.soccerwiki.org/images/player/' + pid + '.png';
            const meta = lookupPlayerMeta(player.name);
            if (meta && meta.image) {
                // backfill ids for next time
                if (!player.soccerwikiId && meta.soccerwikiId) player.soccerwikiId = meta.soccerwikiId;
                if (!player.pid && meta.pid) player.pid = meta.pid;
                return meta.image;
            }
            return null;
        }

        function backfillAllImages(force) {
            if (_imagesBackfilled && !force) return;
            const apply = (p) => {
                if (!p) return;
                if (p.image && String(p.image).indexOf('http') === 0) {
                    if (!p.soccerwikiId && !p.pid) {
                        const meta = lookupPlayerMeta(p.name);
                        if (meta) {
                            if (meta.soccerwikiId) p.soccerwikiId = meta.soccerwikiId;
                            if (meta.pid) p.pid = meta.pid;
                        }
                    }
                    return;
                }
                const meta = lookupPlayerMeta(p.name);
                if (meta) {
                    p.image = meta.image;
                    if (meta.soccerwikiId) p.soccerwikiId = meta.soccerwikiId;
                    if (meta.pid) p.pid = meta.pid;
                    if (!p.nationality && !p.nation && meta.nation) {
                        p.nationality = meta.nation;
                        p.nation = meta.nation;
                    }
                    if (!p.birthYear && meta.birthYear) p.birthYear = meta.birthYear;
                } else {
                    const pid = p.soccerwikiId || p.pid;
                    if (pid) p.image = 'https://cdn.soccerwiki.org/images/player/' + pid + '.png';
                }
            };
            // Chỉ squad + kho thẻ (market render resolve on-the-fly)
            (gameState.squad || []).forEach(apply);
            (gameState.cardInventory || []).forEach(apply);
            _imagesBackfilled = true;
        }

        function effectiveRating(player) {
            const plus = getCardPlusForPlayer(player.name);
            // +1 => +1 OVR, max +10
            return Math.min(99, (player.rating || 70) + plus);
        }

        function buyPlayerCard(marketPlayerId, qty) {
            ensureGameExtras();
            ensureTransferMarket();
            const mp = gameState.transferMarket.find(p => p.id === marketPlayerId);
            if (!mp) { alert('Không tìm thấy thẻ.'); return; }
            let n = parseInt(qty, 10);
            if (!n || n < 1) {
                const input = document.getElementById('card-qty-' + marketPlayerId);
                n = input ? parseInt(input.value, 10) : 1;
            }
            n = Math.max(1, Math.min(20, n || 1));
            const unit = Math.round((mp.value || mp.rating * 150000) * 0.15);
            const price = unit * n;
            if (gameState.budget < price) {
                alert('Không đủ ngân sách mua ' + n + ' thẻ ($' + (price/1e6).toFixed(2) + 'M)!');
                return;
            }
            gameState.budget -= price;
            const img = (typeof resolvePlayerImage === 'function' ? resolvePlayerImage(mp) : null) || mp.image || null;
            const cleanName = String(mp.name || '').replace(/\s*\[Thẻ.*?\]\s*/g, '').trim();
            for (let i = 0; i < n; i++) {
                gameState.cardInventory.push({
                    id: 'card_' + Date.now() + '_' + i + '_' + Math.floor(Math.random()*999),
                    name: cleanName,
                    pos: mp.pos,
                    rating: mp.rating,
                    image: img,
                    age: mp.age,
                    plus: 0,
                    guaranteed: false
                });
            }
            saveGame();
            alert('Đã mua ' + n + ' thẻ ' + cleanName + ' (+0) — $' + (price/1e6).toFixed(2) + 'M');
            updateUI();
            filterTransferMarket();
            renderCardInventory();
        }

        function buyGuaranteedCard(marketPlayerId) {
            ensureGameExtras();
            ensureTransferMarket();
            const mp = gameState.transferMarket.find(p => p.id === marketPlayerId);
            if (!mp) return;
            const price = Math.round((mp.value || mp.rating * 150000) * 0.35);
            if (gameState.budget < price) {
                alert('Không đủ ngân sách mua thẻ ghép 100% ($' + (price/1e6).toFixed(2) + 'M)!');
                return;
            }
            gameState.budget -= price;
            gameState.cardInventory.push({
                id: 'card_' + Date.now() + '_' + Math.floor(Math.random()*999),
                name: mp.name,
                pos: mp.pos,
                rating: mp.rating,
                image: mp.image || null,
                plus: 0,
                guaranteed: true
            });
            saveGame();
            alert('Đã mua thẻ GHÉP 100% ' + mp.name + ' (+0)');
            updateUI();
            filterTransferMarket();
            renderCardInventory();
        }

        let mergeAnimating = false;

        function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

        function spawnMergeSparks(stage) {
            for (let i = 0; i < 14; i++) {
                const s = document.createElement('div');
                s.className = 'merge-spark';
                const angle = (Math.PI * 2 * i) / 14;
                const dist = 60 + Math.random() * 80;
                s.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
                s.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
                s.style.left = '50%';
                s.style.top = '50%';
                s.style.background = i % 2 ? '#fbbf24' : '#34d399';
                stage.appendChild(s);
                setTimeout(() => s.remove(), 750);
            }
        }

        async function playMergeAnimation(a, b, ok, nextPlus) {
            const overlay = document.getElementById('merge-overlay');
            const left = document.getElementById('merge-card-left');
            const right = document.getElementById('merge-card-right');
            const result = document.getElementById('merge-card-result');
            const status = document.getElementById('merge-status');
            const stage = overlay.querySelector('.merge-stage');
            if (!overlay || !left || !right) return;

            // reset
            left.className = 'merge-card-vis left fo4-merge';
            right.className = 'merge-card-vis right fo4-merge';
            result.style.display = 'none';
            result.className = 'merge-card-vis result fo4-merge';
            result.style.opacity = '0';
            status.className = 'merge-status';
            status.textContent = 'Đang ghép...';

            // Render FO4 faces into merge cards
            left.className = 'merge-card-vis left fo4-merge';
            right.className = 'merge-card-vis right fo4-merge';
            left.innerHTML = renderFo4CardFace(a, { plus: a.plus || 0, label: 'CARD' });
            right.innerHTML = renderFo4CardFace(b, { plus: b.plus || 0, label: 'CARD' });
            result.className = 'merge-card-vis result fo4-merge';
            result.innerHTML = '';

            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');

            await sleep(80);
            // Ép vào nhau
            left.classList.add('press');
            right.classList.add('press');
            await sleep(520);
            // Flash
            left.classList.add('flash');
            right.classList.add('flash');
            spawnMergeSparks(stage);
            await sleep(280);
            // Tung ra
            left.classList.remove('press', 'flash');
            right.classList.remove('press', 'flash');
            left.classList.add('fly-out-left');
            right.classList.add('fly-out-right');
            await sleep(380);

            // Kết quả
            left.style.opacity = '0';
            right.style.opacity = '0';
            result.style.display = 'flex';
            if (ok) {
                result.className = 'merge-card-vis result fo4-merge';
                result.innerHTML = renderFo4CardFace(a, { plus: nextPlus, label: 'ICON', rating: a.rating });
                result.style.opacity = '1';
                status.className = 'merge-status ok';
                status.textContent = 'THÀNH CÔNG! ' + a.name + ' +' + nextPlus;
                spawnMergeSparks(stage);
            } else {
                result.className = 'merge-card-vis result fo4-merge fail';
                result.innerHTML = renderFo4CardFace(a, { plus: a.plus || 0, label: 'FAIL' });
                result.style.opacity = '1';
                status.className = 'merge-status fail';
                status.textContent = 'THẤT BẠI — Mất 2 thẻ +' + (a.plus || 0);
            }
            await sleep(1400);

            // cleanup
            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
            left.className = 'merge-card-vis left';
            right.className = 'merge-card-vis right';
            left.style.opacity = '';
            right.style.opacity = '';
            result.style.display = 'none';
        }


        function defaultMergeRates() {
            // % thành công khi ghép 2 thẻ cùng cấp +N → +(N+1)
            return {
                0: 90, 1: 84, 2: 78, 3: 72, 4: 66,
                5: 60, 6: 54, 7: 48, 8: 42, 9: 36
            };
        }

        function getMergeSuccessRate(level) {
            const lvl = Math.max(0, Math.min(9, Number(level) || 0));
            // Ưu tiên: localStorage (admin vừa lưu) > gameState > default
            // Không tin save cloud vì có thể là tỉ lệ cũ
            let rates = null;
            try {
                const raw = localStorage.getItem('fm_merge_rates');
                if (raw) rates = JSON.parse(raw);
            } catch (_) {}
            if (!rates) {
                try {
                    const raw2 = localStorage.getItem('fm_admin_settings');
                    if (raw2) {
                        const s = JSON.parse(raw2);
                        if (s && s.mergeRates) rates = s.mergeRates;
                    }
                } catch (_) {}
            }
            if (!rates && gameState && gameState.mergeRates) rates = gameState.mergeRates;
            if (!rates) rates = defaultMergeRates();
            let pct = rates[lvl];
            if (pct == null) pct = rates[String(lvl)];
            if (pct == null) return Math.max(0.35, 0.9 - lvl * 0.06);
            const n = Number(pct);
            if (isNaN(n)) return Math.max(0.35, 0.9 - lvl * 0.06);
            // Hỗ trợ cả 0-1 (0.9) lẫn 0-100 (90)
            const rate = n > 1 ? n / 100 : n;
            return Math.max(0, Math.min(1, rate));
        }

        /** Đồng bộ tỉ lệ ghép từ admin settings / localStorage vào gameState */
        function syncMergeRatesFromAdmin(settings) {
            let rates = null;
            if (settings && settings.mergeRates) rates = settings.mergeRates;
            if (!rates) {
                try {
                    const raw = localStorage.getItem('fm_merge_rates');
                    if (raw) rates = JSON.parse(raw);
                } catch (_) {}
            }
            if (!rates) {
                try {
                    const raw2 = localStorage.getItem('fm_admin_settings');
                    if (raw2) {
                        const s = JSON.parse(raw2);
                        if (s && s.mergeRates) rates = s.mergeRates;
                    }
                } catch (_) {}
            }
            if (!rates) rates = defaultMergeRates();
            // chuẩn hóa key số
            const normalized = {};
            for (let i = 0; i <= 9; i++) {
                let v = rates[i] != null ? rates[i] : rates[String(i)];
                v = Number(v);
                if (isNaN(v)) v = defaultMergeRates()[i];
                // nếu lỡ lưu dạng 0-1
                if (v > 0 && v <= 1) v = Math.round(v * 100);
                normalized[i] = Math.max(0, Math.min(100, v));
            }
            gameState.mergeRates = normalized;
            try { localStorage.setItem('fm_merge_rates', JSON.stringify(normalized)); } catch (_) {}
            return normalized;
        }

        async function mergeCards(cardIdA, cardIdB) {
            if (mergeAnimating) return;
            ensureGameExtras();
            const inv = gameState.cardInventory;
            const a = inv.find(c => c.id === cardIdA);
            const b = inv.find(c => c.id === cardIdB);
            if (!a || !b || a.id === b.id) return;
            if (a.name !== b.name) {
                alert('Chỉ ghép được 2 thẻ cùng cầu thủ!');
                return;
            }
            if ((a.plus || 0) !== (b.plus || 0)) {
                alert('Hai thẻ phải cùng cấp +' + (a.plus || 0) + '!');
                return;
            }
            const lvl = a.plus || 0;
            if (lvl >= 10) {
                alert('Đã đạt tối đa +10!');
                return;
            }
            const guaranteed = !!(a.guaranteed || b.guaranteed);
            try { syncMergeRatesFromAdmin(); } catch (_) {}
            const successRate = guaranteed ? 1 : getMergeSuccessRate(lvl);
            const ok = Math.random() < successRate;
            console.log('[merge]', a.name, '+' + lvl, 'rate=', Math.round(successRate * 100) + '%', 'ok=', ok);
            const nextPlus = lvl + 1;

            mergeAnimating = true;
            try {
                await playMergeAnimation(a, b, ok, nextPlus);
            } catch (e) { console.warn(e); }

            // apply result after animation
            gameState.cardInventory = inv.filter(c => c.id !== a.id && c.id !== b.id);
            if (ok) {
                gameState.cardInventory.push({
                    id: 'card_' + Date.now() + '_' + Math.floor(Math.random()*999),
                    name: a.name,
                    pos: a.pos,
                    rating: a.rating,
                    image: a.image,
                    plus: nextPlus,
                    guaranteed: false
                });
            }
            mergeAnimating = false;
            selectedCardId = null;
            saveGame();
            renderCardInventory();
            try { renderTacticsTab(); } catch (_) {}
            updateUI();
        }


        function sellCard(cardId) {
            ensureGameExtras();
            const inv = gameState.cardInventory || [];
            const idx = inv.findIndex(c => c.id === cardId);
            if (idx === -1) { alert('Không tìm thấy thẻ.'); return; }
            const card = inv[idx];
            const plus = Number(card.plus) || 0;
            // Giá thẻ: base 8% giá CT * (1 + plus*0.35), thẻ đã ghép (+1 trở lên) bán được
            const baseVal = (card.rating || 70) * (card.rating || 70) * 2200;
            const price = Math.round(baseVal * 0.08 * (1 + plus * 0.35) * (card.guaranteed ? 1.25 : 1));
            if (!confirm('Bán thẻ ' + card.name + ' +' + plus + ' với giá $' + (price/1e6).toFixed(2) + 'M?\nThẻ sẽ lên thị trường chuyển nhượng (người khác / AI có thể mua).')) return;
            inv.splice(idx, 1);
            gameState.cardInventory = inv;
            gameState.budget += price;
            ensureTransferMarket();
            // Đưa bản sao thẻ lên market như listing card
            if (!gameState.cardMarket) gameState.cardMarket = [];
            gameState.cardMarket.unshift({
                id: 'mcard_' + Date.now() + '_' + Math.floor(Math.random()*999),
                name: card.name,
                pos: card.pos,
                rating: card.rating,
                plus: plus,
                age: card.age || 24,
                image: card.image || null,
                value: price,
                clubFrom: gameState.clubName || 'Your Club',
                sellerUid: 'self',
                isCardListing: true,
                guaranteed: !!card.guaranteed
            });
            // Cũng hiện trong transfer market dạng cardOnly listing
            gameState.transferMarket.unshift({
                id: 95000 + Math.floor(Math.random()*4000),
                name: card.name + ' [Thẻ +' + plus + ']',
                pos: card.pos || 'CM',
                rating: card.rating || 70,
                age: card.age || 24,
                image: card.image || null,
                value: price,
                wage: 0,
                clubFrom: gameState.clubName || 'Your Club',
                leagueFrom: 'card_market',
                isReal: true,
                cardOnly: true,
                isCardListing: true,
                cardPlus: plus,
                listedByMe: true
            });
            if (selectedCardId === cardId) selectedCardId = null;
            saveGame();
            alert('Đã bán thẻ +$' + (price/1e6).toFixed(2) + 'M');
            renderCardInventory();
            updateUI();
            if (document.getElementById('tab-transfers') && !document.getElementById('tab-transfers').classList.contains('hidden')) {
                filterTransferMarket();
            }
        }

        let selectedCardId = null;
        let cardPlusFilter = null; // null = hiện tất cả; number = lọc +N

        function addPlayerFromCard(cardId) {
            ensureGameExtras();
            const card = (gameState.cardInventory || []).find(c => c.id === cardId);
            if (!card) { alert('Không tìm thấy thẻ.'); return; }
            if (!canAddToSquad(1)) return;
            const exists = gameState.squad.find(p => p.name === card.name);
            if (exists) {
                alert(card.name + ' đã có trong đội hình (bonus thẻ +' + getCardPlusForPlayer(card.name) + ' đã áp dụng).');
                return;
            }
            const maxId = gameState.squad.reduce((m, p) => Math.max(m, Number(p.id) || 0), 200);
            const pl = makePlayerFromData({
                name: card.name,
                pos: card.pos || 'CM',
                rating: card.rating || 75,
                age: card.age || 24,
                image: card.image || null,
                isReal: true,
                soccerwikiId: card.soccerwikiId || null
            }, maxId + 1);
            pl.matchdayRole = 'reserve';
            pl.isStarting = false;
            pl.fromCard = true;
            gameState.squad.push(pl);
            saveGame();
            alert('Đã thêm ' + card.name + ' vào đội hình (Ngoài danh sách). Vào Chiến thuật để xếp sân / dự bị.');
            updateUI();
            renderCardInventory();
            if (document.getElementById('tab-tactics') && !document.getElementById('tab-tactics').classList.contains('hidden')) {
                renderTacticsTab();
            }
        }

        function renderCardInventory() {
            try { backfillAllImages(false); } catch (_) {}
            ensureGameExtras();
            const box = document.getElementById('card-inventory-list');
            const filtersEl = document.getElementById('card-plus-filters');
            if (!box) return;
            const inv = gameState.cardInventory || [];
            if (!inv.length) {
                box.innerHTML = '<div class="text-slate-500 text-sm col-span-full py-6 text-center">Chưa có thẻ nào. Mua thẻ từ thị trường chuyển nhượng.</div>';
                if (filtersEl) filtersEl.innerHTML = '';
                return;
            }

            const plusLevels = [...new Set(inv.map(c => Number(c.plus) || 0))].sort((a, b) => a - b);

            // Filter bar: Tất cả + các cấp (lọc tùy chọn, mặc định hiện HẾT)
            if (filtersEl) {
                const allOn = cardPlusFilter === null || cardPlusFilter === undefined;
                filtersEl.innerHTML =
                    '<button type="button" data-plus-filter="all" class="px-2.5 py-1 rounded-lg text-[11px] font-bold border '
                    + (allOn ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500')
                    + '">Tất cả <span class="text-slate-500">(' + inv.length + ')</span></button>'
                    + plusLevels.map(lv => {
                        const on = cardPlusFilter === lv;
                        const count = inv.filter(c => (Number(c.plus) || 0) === lv).length;
                        return '<button type="button" data-plus-filter="' + lv + '" class="px-2.5 py-1 rounded-lg text-[11px] font-bold border '
                            + (on ? 'border-amber-400 bg-amber-500/20 text-amber-300' : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500')
                            + '">+' + lv + ' <span class="text-slate-500">(' + count + ')</span></button>';
                    }).join('')
                    + (selectedCardId ? '<span class="text-[11px] text-amber-300/90 self-center ml-1">Đang chọn ghép — bấm thẻ cùng tên + cùng cấp</span>' : '');
                filtersEl.querySelectorAll('[data-plus-filter]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const v = btn.getAttribute('data-plus-filter');
                        cardPlusFilter = (v === 'all') ? null : parseInt(v, 10);
                        renderCardInventory();
                    });
                });
            }

            let list = inv.slice();
            if (cardPlusFilter !== null && cardPlusFilter !== undefined) {
                list = list.filter(c => (Number(c.plus) || 0) === cardPlusFilter);
            }
            list.sort((a, b) => a.name.localeCompare(b.name) || (Number(a.plus)||0) - (Number(b.plus)||0));

            if (!list.length) {
                box.innerHTML = '<div class="text-slate-500 text-sm col-span-full py-6 text-center">Không có thẻ ở bộ lọc này</div>';
                return;
            }

            box.innerHTML = list.map(c => {
                const sel = selectedCardId === c.id;
                const inSquad = gameState.squad.some(p => p.name === c.name);
                const plus = Number(c.plus) || 0;
                let canMerge = false;
                if (selectedCardId && selectedCardId !== c.id) {
                    const selC = inv.find(x => x.id === selectedCardId);
                    if (selC && selC.name === c.name && (Number(selC.plus)||0) === plus) canMerge = true;
                }
                const face = renderFo4CardFace(c, {
                    rating: c.rating,
                    plus: plus,
                    selected: sel,
                    mergeable: canMerge,
                    label: plus > 0 ? ('+' + plus) : (c.guaranteed ? '100%' : (c.rating >= 90 ? 'ICON' : 'CARD'))
                });
                return '<div class="fo4-shell" data-card="' + c.id + '">'
                    + face
                    + '<div class="fo4-actions">'
                    + (sel ? '<div class="text-[10px] text-amber-300 text-center font-bold">Đã chọn ghép</div>' : '')
                    + (canMerge ? '<div class="text-[10px] text-emerald-300 text-center font-bold">Ghép được</div>' : '')
                    + '<div class="text-[10px] text-center ' + (inSquad ? 'text-emerald-400' : 'text-slate-500') + '">' + (inSquad ? 'Trong đội' : 'Ngoài đội') + '</div>'
                    + '<button type="button" data-select-merge="' + c.id + '" class="bg-sky-700 hover:bg-sky-600 text-white">' + (sel ? 'Bỏ chọn' : 'Chọn ghép') + '</button>'
                    + '<button type="button" data-add-squad="' + c.id + '" class="' + (inSquad ? 'bg-slate-800 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-500 text-white') + '">' + (inSquad ? 'Đã trong đội' : 'Thêm vào đội') + '</button>'
                    + '<button type="button" data-sell-card="' + c.id + '" class="bg-amber-700 hover:bg-amber-600 text-white">Bán thẻ</button>'
                    + '</div></div>';
            }).join('');

            box.querySelectorAll('[data-select-merge]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.getAttribute('data-select-merge');
                    if (selectedCardId === id) {
                        selectedCardId = null;
                    } else if (!selectedCardId) {
                        selectedCardId = id;
                    } else {
                        mergeCards(selectedCardId, id);
                        selectedCardId = null;
                        return;
                    }
                    renderCardInventory();
                });
            });
            box.querySelectorAll('[data-add-squad]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    addPlayerFromCard(btn.getAttribute('data-add-squad'));
                });
            });
            box.querySelectorAll('[data-sell-card]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    sellCard(btn.getAttribute('data-sell-card'));
                });
            });
            box.querySelectorAll('.fo4-shell[data-card]').forEach(shell => {
                const face = shell.querySelector('.fo4-card');
                if (!face) return;
                face.style.cursor = 'pointer';
                face.addEventListener('click', () => {
                    const id = shell.getAttribute('data-card');
                    if (selectedCardId === id) {
                        selectedCardId = null;
                    } else if (!selectedCardId) {
                        selectedCardId = id;
                    } else {
                        mergeCards(selectedCardId, id);
                        selectedCardId = null;
                        return;
                    }
                    renderCardInventory();
                });
            });
        }

        function generateTransferMarket() {
            let market = [];
            let id = 5000 + Math.floor(Math.random() * 500);
            const myClubId = gameState.clubId;
            const seen = new Set();
            const allClubs = [];
            try {
                Object.keys(WORLD_CLUBS || {}).forEach(lid => {
                    (WORLD_CLUBS[lid] || []).forEach(c => allClubs.push(Object.assign({}, c, { _league: lid })));
                });
            } catch (e) { console.warn('WORLD_CLUBS', e); }
            try {
                if (typeof VLEAGUE_CLUBS !== 'undefined') {
                    VLEAGUE_CLUBS.forEach(c => allClubs.push(Object.assign({}, c, { _league: 'vleague1' })));
                }
            } catch (e) {}

            // FULL data: mọi CLB kể cả đội mình (đội mình = chỉ mua thẻ, không mua người)
            allClubs.forEach(club => {
                if (!club) return;
                const isOwn = club.id === myClubId;
                const list = (club.players && club.players.length) ? club.players : (club.keyPlayers || []);
                list.forEach(kp => {
                    if (!kp || !kp.name) return;
                    const key = kp.name.toLowerCase();
                    if (seen.has(key)) return;
                    seen.add(key);
                    const rating = kp.rating || 70;
                    market.push({
                        id: id++,
                        name: kp.name,
                        pos: kp.pos || 'CM',
                        rating,
                        age: kp.age || 25,
                        birthYear: kp.birthYear || (2026 - (kp.age || 25)),
                        nationality: kp.nation || kp.nationality || 'Unknown',
                        image: kp.image || (kp.pid || kp.soccerwikiId ? ('https://cdn.soccerwiki.org/images/player/' + (kp.pid || kp.soccerwikiId) + '.png') : null),
                        soccerwikiId: kp.soccerwikiId || kp.pid || null,
                        value: Math.round(rating * rating * 2200),
                        wage: rating * 1600,
                        clubFrom: club.name || 'Unknown',
                        leagueFrom: club._league || 'world',
                        isReal: true,
                        cardOnly: isOwn,
                        isOwnClub: isOwn
                    });
                });
            });

            // Thêm chính cầu thủ trong đội hình hiện tại (phòng data JSON thiếu)
            (gameState.squad || []).forEach(p => {
                if (!p || !p.name) return;
                const key = p.name.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                market.push({
                    id: id++,
                    name: p.name,
                    pos: p.pos || 'CM',
                    rating: p.rating || 70,
                    age: p.age || 25,
                    image: p.image || null,
                    value: Math.round((p.rating || 70) * (p.rating || 70) * 2200),
                    wage: (p.rating || 70) * 1600,
                    clubFrom: gameState.clubName || 'Đội bạn',
                    leagueFrom: gameState.leagueId || 'own',
                    isReal: !!p.isReal,
                    cardOnly: true,
                    isOwnClub: true
                });
            });

            const freeAgents = [
                { name: 'Nguyễn Công Phượng', pos: 'ST', rating: 76, age: 31 },
                { name: 'Phan Văn Đức', pos: 'LW', rating: 75, age: 30 },
                { name: 'Phạm Tuấn Hải', pos: 'ST', rating: 76, age: 27 },
                { name: 'Nguyễn Hoàng Đức', pos: 'CAM', rating: 78, age: 28 },
                { name: 'Đỗ Hùng Dũng', pos: 'CM', rating: 75, age: 32 },
                { name: 'Quế Ngọc Hải', pos: 'CB', rating: 74, age: 33 },
                { name: 'Bùi Tiến Dũng', pos: 'CB', rating: 74, age: 28 },
                { name: 'Nguyễn Văn Toàn', pos: 'RW', rating: 75, age: 30 },
                { name: 'Vũ Văn Thanh', pos: 'RB', rating: 74, age: 30 },
                { name: 'Nguyễn Filip', pos: 'GK', rating: 76, age: 33 }
            ];
            freeAgents.forEach(s => {
                const key = s.name.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                market.push({
                    id: id++, name: s.name, pos: s.pos, rating: s.rating, age: s.age,
                    value: s.rating * 200000, wage: s.rating * 1500,
                    clubFrom: 'Free Agent', leagueFrom: 'free', isReal: true, cardOnly: false
                });
            });

            // Sắp xếp theo rating, FULL list (không cắt 80)
            market.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            
            // Giữ pool đủ lớn để tìm kiếm, ưu tiên OVR cao
            market.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            if (market.length > 250) {
                market = market.slice(0, 250);
            }
return market;
        }


        async function applyPendingGifts() {
            try {
                const user = (window.getCurrentUser && window.getCurrentUser()) || null;
                if (!user || !user.uid) return;
                let gifts = user.pendingGifts || null;
                // local fallback
                if (!gifts) {
                    const raw = localStorage.getItem('fm_pending_gifts_' + user.uid);
                    if (raw) gifts = JSON.parse(raw);
                }
                if (!gifts) return;
                let changed = false;
                const money = Number(gifts.money || 0);
                if (money > 0) {
                    gameState.budget = (gameState.budget || 0) + money;
                    changed = true;
                }
                const players = gifts.players || [];
                players.forEach(gp => {
                    if (!gp || !gp.name) return;
                    if (gameState.squad.some(p => p.name === gp.name)) return;
                    const maxId = gameState.squad.reduce((m, p) => Math.max(m, p.id || 0), 100);
                    const pl = makePlayerFromData({
                        name: gp.name, pos: gp.pos || 'CM', rating: gp.rating || 75,
                        age: gp.age || 24, isReal: true, image: gp.image || null
                    }, maxId + 1 + Math.floor(Math.random()*50));
                    pl.matchdayRole = 'reserve';
                    pl.isStarting = false;
                    gameState.squad.push(pl);
                    changed = true;
                });
                if (changed) {
                    // clear gifts
                    localStorage.removeItem('fm_pending_gifts_' + user.uid);
                    try { await clearPendingGifts(); } catch(e) {}
                    saveGame();
                    alert('Bạn nhận quà từ Admin: ' + (money > 0 ? ('+$' + (money/1e6).toFixed(2) + 'M ') : '') + (players.length ? (players.length + ' cầu thủ') : ''));
                    updateUI();
                }
            } catch (e) { console.warn('applyPendingGifts', e); }
        }

        function ensureTransferMarket(force) {
            ensureGameExtras();
            const m = gameState.transferMarket;
            const needs = force || !m || !Array.isArray(m) || m.length === 0;
            if (needs) {
                gameState.transferMarket = generateTransferMarket();
            }
        }

        // ==================== INIT & CLUB SELECT ====================
        function initGame() {
            const saved = localStorage.getItem('fm_game_save_v2');
            if (saved) {
                try {
                    gameState = JSON.parse(saved);
                    ensureGameExtras();
                    ensureTransferMarket();
                    applyPendingGifts();
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
            container.innerHTML = Object.values(LEAGUES).map(lg => {
                const onclick = lg.unlocked
                    ? "selectLeague('" + lg.id + "')"
                    : "alert('Giải đấu này sẽ được mở rộng trong bản cập nhật sau!')";
                const cardClass = lg.unlocked
                    ? 'bg-slate-900 border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-950/30 cursor-pointer'
                    : 'bg-slate-900/50 border-slate-800 opacity-60 cursor-not-allowed';
                const lockBadge = !lg.unlocked
                    ? '<span class="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">Sắp ra mắt</span>'
                    : '';
                return (
                    '<button onclick="' + onclick + '" class="p-5 rounded-2xl border text-left transition-all ' + cardClass + '">' +
                    '<div class="text-3xl mb-2">' + (lg.icon || '') + '</div>' +
                    '<h3 class="font-extrabold text-slate-100 text-lg">' + lg.name + '</h3>' +
                    '<p class="text-xs text-slate-400 mt-1">' + (lg.country || '') + '</p>' +
                    '<p class="text-xs text-slate-500 mt-2">' + (lg.desc || '') + '</p>' +
                    lockBadge +
                    '</button>'
                );
            }).join('');
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

        let _cloudSaveTimer = null;
        let _cloudSaveInFlight = false;

        function scheduleCloudSave() {
            try {
                if (!getCurrentUser || !getCurrentUser()) return;
            } catch (_) { return; }
            if (_cloudSaveTimer) clearTimeout(_cloudSaveTimer);
            _cloudSaveTimer = setTimeout(async () => {
                if (_cloudSaveInFlight) return;
                _cloudSaveInFlight = true;
                try {
                    await saveGameCloud(gameState);
                    const badge = document.getElementById('cloud-save-badge');
                    if (badge) {
                        badge.textContent = 'Cloud ✓';
                        badge.classList.remove('hidden', 'text-amber-400');
                        badge.classList.add('text-emerald-400');
                        setTimeout(() => badge.classList.add('hidden'), 2000);
                    }
                } catch (e) {
                    console.warn('cloud save', e);
                } finally {
                    _cloudSaveInFlight = false;
                }
            }, 1500);
        }

        function saveGame() {
            try {
                // Bỏ transferMarket nặng khỏi local save (regenerate khi cần)
                const slim = Object.assign({}, gameState);
                if (Array.isArray(slim.transferMarket) && slim.transferMarket.length > 20) {
                    slim.transferMarket = [];
                }
                const json = JSON.stringify(slim);
                localStorage.setItem('fm_game_save_v2', json);
                localStorage.setItem('fm_game_save', json);
            } catch (e) {
                console.warn('local save failed', e);
            }
            scheduleCloudSave();
        }

        async function saveGameManual() {
            saveGame();
            try {
                if (getCurrentUser()) {
                    await saveGameCloud(gameState);
                    alert('Đã lưu local + Firebase thành công!');
                } else {
                    alert('Đã lưu local (chưa đăng nhập — không đồng bộ cloud).');
                }
            } catch (e) {
                alert('Đã lưu local. Cloud lỗi: ' + (e.message || e));
            }
        }

        function resetGamePrompt() {
            if (confirm('Bạn có chắc muốn xóa tiến trình local và cloud rồi chơi lại?')) {
                localStorage.removeItem('fm_game_save_v2');
                localStorage.removeItem('fm_game_save');
                const u = getCurrentUser && getCurrentUser();
                if (u) {
                    // wipe cloud save by writing empty marker
                    saveGameCloud({ reset: true, clubName: null }).catch(() => {});
                    localStorage.removeItem('fm_cloud_save_' + u.uid);
                }
                location.reload();
            }
        }

        // Lưu cloud khi thoát / ẩn tab
        window.addEventListener('beforeunload', () => {
            try {
                localStorage.setItem('fm_game_save_v2', JSON.stringify(gameState));
            } catch (_) {}
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && gameState && gameState.clubName) {
                try {
                    localStorage.setItem('fm_game_save_v2', JSON.stringify(gameState));
                    if (getCurrentUser()) saveGameCloud(gameState).catch(() => {});
                } catch (_) {}
            }
        });

        // ==================== UI ====================
        function switchTab(tabId) {
            AudioFX.click();
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
            const tabEl = document.getElementById('tab-' + tabId);
            if (tabEl) tabEl.classList.remove('hidden');
            // Desktop side nav
            const sideBtn = document.getElementById('nav-' + tabId);
            if (sideBtn) sideBtn.classList.add('active');
            // Mobile bottom nav
            document.querySelectorAll('#bottom-nav .nav-tab').forEach(el => {
                if (el.getAttribute('data-nav') === tabId) el.classList.add('active');
            });
            if (tabId === 'tactics') renderTacticsTab();
            if (tabId === 'transfers') renderTransfersTab();
            if (tabId === 'league') renderLeagueTab();
            if (tabId === 'facilities') renderFacilitiesTab();
            if (tabId === 'finance') renderFinanceTab();
        }

        let _uiRaf = null;
        function updateUI() {
            if (_uiRaf) return;
            _uiRaf = requestAnimationFrame(() => {
                _uiRaf = null;
                updateUINow();
            });
        }
        function updateUINow() {
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
            if (matched.length === 0) {
                // fallback: average all players with effective rating
                if (!players || !players.length) return 70;
                return players.reduce((s, p) => s + effectiveRating(p), 0) / players.length;
            }
            return matched.reduce((s, p) => s + effectiveRating(p), 0) / matched.length;
        }

        /** Chỉ số trận thực tế: OVR hiệu dụng + thể lực + morale */
        function getTeamMatchPower(starters) {
            if (!starters || !starters.length) {
                return { att: 65, mid: 65, def: 65, ovr: 65, stamina: 80 };
            }
            const att = calculateAvgRating(starters, ['ST','CF','RW','LW','CAM']);
            const mid = calculateAvgRating(starters, ['CM','CDM','CAM','LM','RM']);
            const def = calculateAvgRating(starters, ['CB','LB','RB','LWB','RWB','GK']);
            const ovr = starters.reduce((s, p) => s + effectiveRating(p), 0) / starters.length;
            const stamina = starters.reduce((s, p) => s + (p.stamina != null ? p.stamina : 100), 0) / starters.length;
            // morale CLB
            const moraleBonus = ((gameState.morale || 70) - 70) * 0.08;
            // form gần đây
            let formBonus = 0;
            starters.forEach(p => {
                const recent = (p.form || []).slice(-5);
                if (recent.length) {
                    const score = recent.reduce((s, r) => s + (r === 'W' ? 1 : r === 'D' ? 0.3 : 0), 0);
                    formBonus += score / recent.length;
                }
            });
            formBonus = (formBonus / Math.max(1, starters.length)) * 2;
            const stamFactor = 0.85 + (stamina / 100) * 0.15; // 85%–100%
            return {
                att: (att + moraleBonus + formBonus) * stamFactor,
                mid: (mid + moraleBonus + formBonus * 0.7) * stamFactor,
                def: (def + moraleBonus * 0.5 + formBonus * 0.5) * stamFactor,
                ovr: ovr * stamFactor,
                stamina
            };
        }

        /** Chuyển chênh lệch chỉ số → xác suất (logistic) */
        function strengthToProb(myStat, oppStat, base, scale) {
            // base ~0.28 khi ngang sức; scale càng nhỏ càng nhạy với chênh lệch
            const diff = myStat - oppStat;
            const x = diff / (scale || 9);
            // logistic centered at base
            const logistic = 1 / (1 + Math.exp(-x));
            // map logistic 0.5 → base
            const p = base + (logistic - 0.5) * 0.7;
            return Math.max(0.06, Math.min(0.72, p));
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

        // ==================== TACTICS (kéo thả) ====================
        let dragPlayerId = null;
        let dragFromSlot = null;
        let selectedTacticsPlayerId = null;

        function positionsCompatible(posA, posB) {
            // Chỉ cùng đúng vị trí (ST-ST, LW-LW, ...) — không gộp LW/RW hay CM/CDM
            if (!posA || !posB) return false;
            return String(posA).toUpperCase() === String(posB).toUpperCase();
        }

        function selectTacticsPlayer(playerId) {
            const id = playerId == null ? null : Number(playerId);
            if (selectedTacticsPlayerId === id) {
                selectedTacticsPlayerId = null;
            } else {
                selectedTacticsPlayerId = id;
            }
            renderTacticsTab();
        }

        function swapWithSelected(targetPlayerId) {
            if (selectedTacticsPlayerId == null) return;
            const a = gameState.squad.find(p => p.id === selectedTacticsPlayerId);
            const b = gameState.squad.find(p => p.id === targetPlayerId);
            if (!a || !b || a.id === b.id) return;
            if (a.injuryWeeks > 0 || b.injuryWeeks > 0) {
                alert('Cầu thủ đang chấn thương, không thể đổi!');
                return;
            }
            // Swap starting status + slotIndex
            const aStart = a.isStarting, aSlot = a.slotIndex;
            const bStart = b.isStarting, bSlot = b.slotIndex;
            a.isStarting = bStart; a.slotIndex = bSlot;
            b.isStarting = aStart; b.slotIndex = aSlot;
            selectedTacticsPlayerId = null;
            saveGame();
            renderTacticsTab();
            updateUI();
        }


        function assignStartersBySlots(slotPlayers) {
            // slotPlayers: array of player ids or null length 11
            gameState.squad.forEach(p => { p.isStarting = false; p.slotIndex = null; });
            slotPlayers.forEach((pid, idx) => {
                if (pid == null) return;
                const pl = gameState.squad.find(p => p.id === pid);
                if (pl) {
                    pl.isStarting = true;
                    pl.slotIndex = idx;
                }
            });
        }

        function getSlotAssignments(formation) {
            const slots = getFormationPositions(formation);
            const starters = gameState.squad.filter(p => p.isStarting);
            // Prefer slotIndex if set
            const assigned = new Array(slots.length).fill(null);
            const used = new Set();
            starters.forEach(p => {
                if (typeof p.slotIndex === 'number' && p.slotIndex >= 0 && p.slotIndex < slots.length && !assigned[p.slotIndex]) {
                    assigned[p.slotIndex] = p;
                    used.add(p.id);
                }
            });
            // Fill remaining by position match
            slots.forEach((slot, idx) => {
                if (assigned[idx]) return;
                let match = starters.find(p => !used.has(p.id) && p.pos === slot.pos);
                if (!match) match = starters.find(p => !used.has(p.id) && p.pos !== 'GK');
                if (!match) match = starters.find(p => !used.has(p.id));
                if (match) {
                    assigned[idx] = match;
                    match.slotIndex = idx;
                    used.add(match.id);
                }
            });
            return assigned;
        }

        function placePlayerInSlot(playerId, slotIndex) {
            const player = gameState.squad.find(p => p.id === playerId);
            if (!player || player.injuryWeeks > 0) return;
            const slots = getFormationPositions(gameState.formation);
            if (slotIndex < 0 || slotIndex >= slots.length) return;

            const assigned = getSlotAssignments(gameState.formation);
            const existing = assigned[slotIndex];

            // If player already starting in another slot, clear that slot
            const prevSlot = typeof player.slotIndex === 'number' ? player.slotIndex : assigned.findIndex(p => p && p.id === playerId);

            if (existing && existing.id !== playerId) {
                // swap
                if (prevSlot >= 0) {
                    existing.slotIndex = prevSlot;
                    existing.isStarting = true;
                } else {
                    existing.isStarting = false;
                    existing.slotIndex = null;
                }
            }

            player.isStarting = true;
            player.slotIndex = slotIndex;
            player.matchdayRole = 'start';

            // Cap at 11 starters: if more, bench lowest without slot
            const starters = gameState.squad.filter(p => p.isStarting);
            if (starters.length > 11) {
                starters
                    .filter(p => p.id !== playerId && (p.slotIndex === null || p.slotIndex === undefined))
                    .sort((a,b) => a.rating - b.rating)
                    .forEach(p => { p.isStarting = false; });
            }
            // Rebuild strict 11 from slots
            const finalAssigned = getSlotAssignments(gameState.formation);
            gameState.squad.forEach(p => { p.isStarting = false; });
            finalAssigned.forEach((pl, idx) => {
                if (pl) {
                    const real = gameState.squad.find(x => x.id === pl.id);
                    if (real) { real.isStarting = true; real.slotIndex = idx; }
                }
            });
            saveGame();
            renderTacticsTab();
        }

        function renderTacticsTab() {
            try { backfillAllImages(false); } catch (_) {}
            const pitchContainer = document.getElementById('pitch-players-container');
            const rosterContainer = document.getElementById('squad-roster-list');
            if (!pitchContainer || !rosterContainer) return;

            const formation = gameState.formation;
            const slots = getFormationPositions(formation);
            const assigned = getSlotAssignments(formation);
            const starters = gameState.squad.filter(p => p.isStarting);
            const selected = selectedTacticsPlayerId != null
                ? gameState.squad.find(p => p.id === selectedTacticsPlayerId)
                : null;
            const selectedPos = selected ? selected.pos : null;

            const countEl = document.getElementById('squad-starting-count');
            if (countEl) {
                countEl.innerHTML = starters.length + ' / 11 Ra Sân'
                    + (selected
                        ? ' <span class="text-amber-400 font-semibold">· Chọn: ' + selected.name.split(' ').pop()
                        + ' (' + selected.pos + ') — bấm cầu thủ cùng vị trí để đổi</span>'
                        : ' <span class="text-slate-500">· Bấm cầu thủ để chọn & làm sáng dự bị cùng vị trí</span>');
            }
            const formSel = document.getElementById('formation-select');
            if (formSel) formSel.value = formation;

            pitchContainer.innerHTML = '';
            pitchContainer.style.position = 'relative';
            pitchContainer.style.width = '100%';
            pitchContainer.style.height = '100%';

            slots.forEach((slot, idx) => {
                const player = assigned[idx];
                const el = document.createElement('div');
                el.className = 'absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10';
                let topPos = slot.top, leftPos = slot.left;
                if (gameState.formation === 'FREE' && player && gameState.freePositions && gameState.freePositions[player.id]) {
                    topPos = gameState.freePositions[player.id].top;
                    leftPos = gameState.freePositions[player.id].left;
                }
                el.style.top = topPos;
                el.style.left = leftPos;
                el.dataset.slotIndex = String(idx);

                const slotMatches = selected && positionsCompatible(selectedPos, slot.pos);
                if (slotMatches && !player) {
                    el.classList.add('pos-slot-glow');
                }

                el.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    el.classList.add('scale-110');
                });
                el.addEventListener('dragleave', () => el.classList.remove('scale-110'));
                el.addEventListener('drop', (e) => {
                    e.preventDefault();
                    el.classList.remove('scale-110');
                    const pid = parseInt(e.dataTransfer.getData('text/playerId') || dragPlayerId, 10);
                    if (!isNaN(pid)) {
                        placePlayerInSlot(pid, idx);
                        selectedTacticsPlayerId = null;
                    }
                    dragPlayerId = null;
                });

                if (player) {
                    el.draggable = true;
                    el.style.cursor = 'pointer';
                    const isSelected = selected && selected.id === player.id;
                    const isCompatibleOther = selected && selected.id !== player.id && positionsCompatible(selectedPos, player.pos);

                    el.addEventListener('dragstart', (e) => {
                        dragPlayerId = player.id;
                        dragFromSlot = idx;
                        selectedTacticsPlayerId = player.id;
                        e.dataTransfer.setData('text/playerId', String(player.id));
                        e.dataTransfer.effectAllowed = 'move';
                    });
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (selected && selected.id !== player.id && positionsCompatible(selectedPos, player.pos)) {
                            // swap with selected
                            swapWithSelected(player.id);
                            return;
                        }
                        if (selected && selected.id === player.id) {
                            // toggle off; second mode: bench if hold? just deselect
                            selectedTacticsPlayerId = null;
                            renderTacticsTab();
                            return;
                        }
                        selectTacticsPlayer(player.id);
                    });
                    el.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        player.isStarting = false;
                        player.slotIndex = null;
                        if (selectedTacticsPlayerId === player.id) selectedTacticsPlayerId = null;
                        saveGame();
                        renderTacticsTab();
                    });

                    const shortName = player.name.split(' ').pop();
                    const cardPlus = getCardPlusForPlayer(player.name);
                    const ringClass = isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/30'
                        : (isCompatibleOther
                            ? 'border-sky-400 ring-2 ring-sky-400/50 shadow-lg shadow-sky-500/25 pos-player-glow'
                            : 'border-emerald-400');

                    const imgUrl = resolvePlayerImage(player);
                    if (imgUrl) {
                        if (!player.image) player.image = imgUrl;
                        const im = document.createElement('img');
                        im.src = imgUrl;
                        im.alt = shortName;
                        im.loading = 'lazy';
                        im.referrerPolicy = 'no-referrer';
                        im.className = 'w-10 h-10 rounded-full object-cover border-2 bg-slate-800 ' + ringClass;
                        im.addEventListener('error', function() {
                            const badge = document.createElement('div');
                            badge.className = 'w-10 h-10 rounded-full bg-slate-900 border-2 text-emerald-400 flex items-center justify-center text-xs font-black ' + ringClass;
                            badge.textContent = String(typeof effectiveRating === 'function' ? effectiveRating(player) : player.rating);
                            if (im.parentNode) im.replaceWith(badge);
                        });
                        el.appendChild(im);
                    } else {
                        const badge = document.createElement('div');
                        badge.className = 'w-10 h-10 rounded-full bg-slate-900 border-2 text-emerald-400 flex items-center justify-center text-xs font-black ' + ringClass;
                        badge.textContent = String(typeof effectiveRating === 'function' ? effectiveRating(player) : player.rating);
                        el.appendChild(badge);
                    }
                    if (typeof cardPlus === 'number' && cardPlus > 0) {
                        const plusEl = document.createElement('div');
                        plusEl.className = 'absolute -top-2 left-1/2 -translate-x-1/2 z-20 px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-black shadow-lg border border-amber-200 leading-none';
                        plusEl.textContent = '+' + cardPlus;
                        plusEl.title = 'Thẻ ghép +' + cardPlus;
                        el.style.position = 'absolute';
                        el.appendChild(plusEl);
                    }
                    const label = document.createElement('div');
                    label.className = 'bg-slate-900/90 text-[10px] text-slate-100 px-2 py-0.5 rounded border mt-1 font-semibold whitespace-nowrap shadow '
                        + (isSelected ? 'border-amber-400 text-amber-200' : (isCompatibleOther ? 'border-sky-400 text-sky-200' : 'border-slate-700'));
                    label.textContent = player.name + ' (' + slot.pos + ')';
                    label.title = player.name;
                    label.style.maxWidth = '110px';
                    label.style.overflow = 'hidden';
                    label.style.textOverflow = 'ellipsis';
                    el.appendChild(label);
                } else {
                    el.style.cursor = slotMatches ? 'pointer' : 'default';
                    el.innerHTML = '<div class="w-10 h-10 rounded-full bg-slate-800/80 border-2 border-dashed '
                        + (slotMatches ? 'border-amber-400 text-amber-300 pos-slot-glow' : 'border-slate-500 text-slate-400')
                        + ' flex items-center justify-center text-xs font-bold">+</div><div class="text-[9px] mt-1 '
                        + (slotMatches ? 'text-amber-300 font-bold' : 'text-slate-400') + '">' + slot.pos + '</div>';
                    if (selected && slotMatches) {
                        el.addEventListener('click', () => {
                            placePlayerInSlot(selected.id, idx);
                            selectedTacticsPlayerId = null;
                        });
                    }
                }
                pitchContainer.appendChild(el);
            });


            // FREE formation: kéo tự do trên sân
            if (gameState.formation === 'FREE') {
                if (!gameState.freePositions) gameState.freePositions = {};
                pitchContainer.querySelectorAll('[data-slot-index]').forEach(el => {
                    const idx = parseInt(el.dataset.slotIndex, 10);
                    const pl = assigned[idx];
                    if (!pl) return;
                    el.style.cursor = 'move';
                    let dragging = false;
                    el.addEventListener('pointerdown', (e) => {
                        if (e.button !== 0) return;
                        dragging = true;
                        el.setPointerCapture(e.pointerId);
                        e.preventDefault();
                    });
                    el.addEventListener('pointermove', (e) => {
                        if (!dragging) return;
                        const rect = pitchContainer.getBoundingClientRect();
                        let x = ((e.clientX - rect.left) / rect.width) * 100;
                        let y = ((e.clientY - rect.top) / rect.height) * 100;
                        x = Math.max(5, Math.min(95, x));
                        y = Math.max(5, Math.min(95, y));
                        el.style.left = x + '%';
                        el.style.top = y + '%';
                        gameState.freePositions[pl.id] = { top: y + '%', left: x + '%' };
                    });
                    el.addEventListener('pointerup', () => {
                        if (dragging) { dragging = false; saveGame(); }
                    });
                });
            }

            const penaltySelect = document.getElementById('penalty-taker-select');
            if (penaltySelect) {
                penaltySelect.innerHTML = gameState.squad.map(p =>
                    '<option value="' + p.id + '" ' + (p.id === gameState.penaltyTakerId ? 'selected' : '') + '>' + p.name + ' (OVR: ' + p.rating + ')</option>'
                ).join('');
            }

            // ===== Split: XI / Bench(7) / Reserve =====
            ensureGameExtras();
            const startersList = gameState.squad.filter(p => p.isStarting).sort((a,b) => b.rating - a.rating);
            const benchList = gameState.squad.filter(p => !p.isStarting && p.matchdayRole === 'bench').sort((a,b) => b.rating - a.rating);
            const reserveList = gameState.squad.filter(p => !p.isStarting && p.matchdayRole !== 'bench').sort((a,b) => b.rating - a.rating);

            function rowHtml(player, section) {
                const injured = player.injuryWeeks > 0;
                const isSelected = selected && selected.id === player.id;
                const isMatch = selected && selected.id !== player.id && !injured && positionsCompatible(selectedPos, player.pos);
                const plus = getCardPlusForPlayer(player.name);
                const eff = Math.min(99, player.rating + plus);
                let rowClass = injured
                    ? 'bg-red-950/20 border-red-500/30 opacity-70'
                    : (isSelected
                        ? 'bg-amber-950/40 border-amber-400/70 ring-1 ring-amber-400/40'
                        : (isMatch
                            ? 'bg-sky-950/40 border-sky-400/60 ring-1 ring-sky-400/30 pos-player-glow'
                            : (section === 'start' ? 'bg-emerald-950/20 border-emerald-500/30' : (section === 'bench' ? 'bg-indigo-950/20 border-indigo-500/25' : 'bg-slate-950/60 border-slate-800'))));
                const badge = injured ? 'INJ' : (isSelected ? '✓' : (isMatch ? '↔' : (section === 'start' ? 'ST' : (section === 'bench' ? 'BN' : 'RS'))));
                const badgeCls = injured ? 'bg-red-900 text-red-300' : (isSelected ? 'bg-amber-400 text-slate-950' : (isMatch ? 'bg-sky-400 text-slate-950' : (section === 'start' ? 'bg-emerald-500 text-slate-950' : (section === 'bench' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'))));
                return (
                    '<div class="p-2.5 rounded-xl border ' + rowClass +
                    ' flex items-center justify-between hover:border-slate-600 cursor-pointer transition-all" draggable="' + (!injured) +
                    '" data-player-id="' + player.id + '" data-pos="' + player.pos + '">' +
                    '<div class="flex items-center gap-2 min-w-0">' +
                    '<span class="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ' + badgeCls + '">' + badge + '</span>' +
                    '<div class="min-w-0">' +
                    '<div class="font-bold text-xs text-slate-200 truncate" title="' + player.name + '">' + player.name +
                    (player.isReal ? ' <span class="text-[9px] text-amber-400">THẬT</span>' : '') +
                    (plus > 0 ? ' <span class="text-[9px] text-amber-300 font-black">+' + plus + '</span>' : '') +
                    ' <span class="text-[10px] ' + (isMatch || isSelected ? 'text-sky-300 font-bold' : 'text-slate-400') + '">' + player.pos + '</span></div>' +
                    '<div class="text-[10px] text-slate-500">OVR ' + player.rating + (plus ? ' → <span class="text-emerald-400">' + eff + '</span>' : '') + '</div>' +
                    '</div></div>' +
                    '<div class="flex items-center gap-1 shrink-0">' +
                    '<select data-role-for="' + player.id + '" class="bg-slate-800 border border-slate-700 text-[10px] rounded px-1 py-0.5 text-slate-300 max-w-[100px]" onclick="event.stopPropagation()">' +
                    '<option value="start"' + (section==='start'?' selected':'') + '>Ra sân</option>' +
                    '<option value="bench"' + (section==='bench'?' selected':'') + '>Dự bị</option>' +
                    '<option value="reserve"' + (section==='reserve'?' selected':'') + '>Ngoài DS</option>' +
                    '<option value="list_market">Đăng bán</option>' +
                    '<option value="sell_now">Bán ngay</option>' +
                    '<option value="release">Sa thải</option>' +
                    '</select>' +
                    '<span class="text-sm font-black text-amber-400 w-6 text-right">' + eff + '</span>' +
                    '</div></div>'
                );
            }

            function sectionBlock(title, color, list, section, hint) {
                return '<div class="space-y-1.5">' +
                    '<div class="flex items-center justify-between sticky top-0 bg-slate-900/95 py-1 z-[1]">' +
                    '<span class="text-[11px] font-bold ' + color + '">' + title + ' <span class="text-slate-500 font-semibold">(' + list.length + ')</span></span>' +
                    (hint ? '<span class="text-[9px] text-slate-500">' + hint + '</span>' : '') +
                    '</div>' +
                    (list.length ? list.map(p => rowHtml(p, section)).join('') : '<div class="text-[11px] text-slate-600 px-1 py-2">Trống</div>') +
                    '</div>';
            }

            rosterContainer.innerHTML =
                sectionBlock('① Đội hình ra sân', 'text-emerald-400', startersList, 'start', 'tối đa 11') +
                sectionBlock('② Dự bị trận (7)', 'text-indigo-300', benchList, 'bench', benchList.length + '/7') +
                sectionBlock('③ Ngoài danh sách', 'text-slate-400', reserveList, 'reserve', '');

            rosterContainer.querySelectorAll('[data-player-id]').forEach(row => {
                const pid = parseInt(row.dataset.playerId, 10);
                row.addEventListener('dragstart', (e) => {
                    dragPlayerId = pid;
                    selectedTacticsPlayerId = pid;
                    e.dataTransfer.setData('text/playerId', String(pid));
                    e.dataTransfer.effectAllowed = 'move';
                });
                row.addEventListener('click', (e) => {
                    if (e.target.closest('select')) return;
                    const pl = gameState.squad.find(p => p.id === pid);
                    if (!pl || pl.injuryWeeks > 0) return;
                    if (selected && selected.id !== pid && positionsCompatible(selectedPos, pl.pos)) {
                        swapWithSelected(pid);
                        return;
                    }
                    selectTacticsPlayer(pid);
                });
                row.addEventListener('dblclick', () => {
                    const pl = gameState.squad.find(p => p.id === pid);
                    if (!pl || pl.injuryWeeks > 0) return;
                    const slots2 = getFormationPositions(gameState.formation === 'FREE' ? '4-3-3' : gameState.formation);
                    const assigned2 = getSlotAssignments(gameState.formation === 'FREE' ? '4-3-3' : gameState.formation);
                    let target = assigned2.findIndex((p, i) => !p && slots2[i].pos === pl.pos);
                    if (target < 0) target = assigned2.findIndex(p => !p);
                    if (target >= 0) {
                        placePlayerInSlot(pid, target);
                        selectedTacticsPlayerId = null;
                    }
                });
            });
            rosterContainer.querySelectorAll('[data-role-for]').forEach(sel => {
                sel.addEventListener('change', () => {
                    setMatchdayRole(parseInt(sel.getAttribute('data-role-for'), 10), sel.value);
                });
            });
            updatePresetButtons();
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
            ensureTransferMarket();
            populateTransferFilterOptions();
            filterTransferMarket();
            renderYouthAcademy();
            renderCardInventory();
        }

        function switchTransferSubtab(subtab) {
            ['market','youth','cards'].forEach(s => {
                const el = document.getElementById('subtab-' + s);
                if (el) el.classList.toggle('hidden', subtab !== s);
                const btn = document.getElementById('subtab-btn-' + s);
                if (btn) btn.className = subtab === s
                    ? 'pb-3 px-2 font-bold text-sm text-emerald-400 border-b-2 border-emerald-400'
                    : 'pb-3 px-2 font-semibold text-sm text-slate-400 hover:text-slate-200';
            });
            if (subtab === 'cards') renderCardInventory();
            if (subtab === 'market') filterTransferMarket();
            if (subtab === 'youth') renderYouthAcademy();
        }

        function filterTransferMarket() {
            ensureTransferMarket();
            const query = (document.getElementById('transfer-search')?.value || '').trim().toLowerCase();
            const clubQ = (document.getElementById('transfer-club-filter')?.value || '').trim().toLowerCase();
            const nationQ = (document.getElementById('transfer-nation-filter')?.value || '').trim().toLowerCase();
            const posFilter = document.getElementById('transfer-pos-filter')?.value || 'ALL';
            const ovrMin = parseInt(document.getElementById('transfer-ovr-min')?.value, 10);
            const ovrMax = parseInt(document.getElementById('transfer-ovr-max')?.value, 10);
            const container = document.getElementById('transfer-market-cards');
            const countEl = document.getElementById('transfer-result-count');
            if (!container) return;

            const list = gameState.transferMarket || [];
            const hasFilter = !!(query || clubQ || nationQ || (posFilter && posFilter !== 'ALL')
                || (!isNaN(ovrMin) && document.getElementById('transfer-ovr-min')?.value !== '')
                || (!isNaN(ovrMax) && document.getElementById('transfer-ovr-max')?.value !== ''));

            let filtered = list.filter(p => {
                if (query) {
                    const n = (p.name || '').toLowerCase();
                    if (!n.includes(query)) return false;
                }
                if (clubQ) {
                    const c = (p.clubFrom || '').toLowerCase();
                    if (!c.includes(clubQ)) return false;
                }
                if (nationQ) {
                    const nat = (p.nationality || p.nation || '').toLowerCase();
                    if (!nat.includes(nationQ)) return false;
                }
                if (posFilter && posFilter !== 'ALL') {
                    if (posFilter === 'FW') {
                        if (!['ST','RW','LW'].includes(p.pos)) return false;
                    } else if (posFilter === 'MF') {
                        if (!['CM','CAM','CDM','LM','RM'].includes(p.pos)) return false;
                    } else if (posFilter === 'DF') {
                        if (!['CB','LB','RB'].includes(p.pos)) return false;
                    } else if (posFilter === 'GK') {
                        if (p.pos !== 'GK') return false;
                    } else {
                        // exact pos
                        if (p.pos !== posFilter) return false;
                    }
                }
                const r = p.rating || 0;
                if (!isNaN(ovrMin) && document.getElementById('transfer-ovr-min')?.value !== '' && r < ovrMin) return false;
                if (!isNaN(ovrMax) && document.getElementById('transfer-ovr-max')?.value !== '' && r > ovrMax) return false;
                return true;
            });

            // Sắp xếp OVR giảm dần
            filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));

            // Mặc định chỉ 20 hot nhất; khi đang lọc hiện tối đa 40
            const limit = hasFilter ? 40 : 20;
            const totalMatch = filtered.length;
            filtered = filtered.slice(0, limit);

            if (countEl) {
                countEl.textContent = hasFilter
                    ? ('Tìm thấy ' + totalMatch + (totalMatch > limit ? ' · hiện ' + limit : ''))
                    : ('Top ' + filtered.length + ' hot nhất');
            }

            if (filtered.length === 0) {
                container.innerHTML = '<div class="col-span-full text-center py-8 text-slate-500 text-sm">Không có cầu thủ khớp bộ lọc. <button type="button" onclick="clearTransferFilters()" class="text-emerald-400 underline">Xóa lọc</button> · <button type="button" onclick="gameState.transferMarket=generateTransferMarket();populateTransferFilterOptions();filterTransferMarket();" class="text-sky-400 underline">Làm mới market</button></div>';
                return;
            }

            container.innerHTML = filtered.map(player => {
                const price = player.value || player.rating * 180000;
                const cardPrice = Math.round(price * 0.15);
                const gCardPrice = Math.round(price * 0.35);
                const face = renderFo4CardFace(player, { rating: player.rating, label: player.rating >= 90 ? 'ICON' : (player.isReal ? 'GOLD' : '') });
                return '<div class="fo4-shell">'
                    + face
                    + '<div class="fo4-actions">'
                    + (player.cardOnly || player.isOwnClub
                        ? '<div class="text-center text-[10px] text-slate-500 py-1">Chỉ mua thẻ</div>'
                        : '<button onclick="buyPlayer(' + player.id + ')" class="bg-emerald-600 hover:bg-emerald-500 text-white">Mua · $' + (price/1e6).toFixed(2) + 'M</button>')
                    + '<div class="flex items-center gap-1">'
                    + '<input id="card-qty-' + player.id + '" type="number" min="1" max="20" value="1" class="w-11 px-1 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-center text-slate-200" onclick="event.stopPropagation()">'
                    + '<button onclick="buyPlayerCard(' + player.id + ')" class="flex-1 bg-sky-700 hover:bg-sky-600 text-white">Mua thẻ $' + (cardPrice/1e6).toFixed(2) + 'M</button>'
                    + '</div>'
                    + '<button onclick="buyGuaranteedCard(' + player.id + ')" class="bg-amber-700 hover:bg-amber-600 text-white">Thẻ 100% $' + (gCardPrice/1e6).toFixed(2) + 'M</button>'
                    + '</div></div>';
            }).join('');
        }

        function clearTransferFilters() {
            const ids = ['transfer-search', 'transfer-club-filter', 'transfer-nation-filter', 'transfer-ovr-min', 'transfer-ovr-max'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const pos = document.getElementById('transfer-pos-filter');
            if (pos) pos.value = 'ALL';
            filterTransferMarket();
        }

        function populateTransferFilterOptions() {
            ensureTransferMarket();
            const list = gameState.transferMarket || [];
            const clubs = new Set();
            const nations = new Set();
            list.forEach(p => {
                if (p.clubFrom) clubs.add(p.clubFrom);
                const n = p.nationality || p.nation;
                if (n && n !== 'Unknown') nations.add(n);
            });
            const clubList = document.getElementById('transfer-club-list');
            const nationList = document.getElementById('transfer-nation-list');
            if (clubList) {
                clubList.innerHTML = [...clubs].sort().map(c => '<option value="' + c.replace(/"/g, '&quot;') + '">').join('');
            }
            if (nationList) {
                nationList.innerHTML = [...nations].sort().map(c => '<option value="' + c.replace(/"/g, '&quot;') + '">').join('');
            }
        }

        function canAddToSquad(extra) {
            const n = (gameState.squad || []).length + (extra || 1);
            if (n > MAX_SQUAD_SIZE) {
                alert('Đội đã đủ tối đa ' + MAX_SQUAD_SIZE + ' cầu thủ!');
                return false;
            }
            return true;
        }

        function buyPlayer(playerId) {
            const playerIndex = gameState.transferMarket.findIndex(p => p.id === playerId);
            if (playerIndex === -1) return;
            const player = gameState.transferMarket[playerIndex];
            if (!canAddToSquad(1)) return;
            if (gameState.budget < player.value) {
                alert("Ngân sách của bạn không đủ để chiêu mộ cầu thủ này!");
                return;
            }
            gameState.budget -= player.value;
            player.isStarting = false;
            player.stamina = 100; player.goals = 0; player.assists = 0; player.yellowCards = 0;
            player.matchdayRole = 'reserve';
            gameState.squad.push(player);
            gameState.transferMarket.splice(playerIndex, 1);
            AudioFX.click();
            alert(`Chúc mừng! Bạn đã chiêu mộ thành công ${player.name} với giá $${(player.value/1000000).toFixed(2)}M!`);
            updateUI();
            filterTransferMarket();
        }


        function sellPlayer(playerId) {
            const idx = gameState.squad.findIndex(p => p.id === playerId);
            if (idx === -1) return;
            const player = gameState.squad[idx];
            if (gameState.squad.length <= MIN_SQUAD_SIZE) {
                alert('Đội cần tối thiểu ' + MIN_SQUAD_SIZE + ' cầu thủ. Không thể bán thêm.');
                return;
            }
            const price = Math.round((player.value || player.rating * 150000) * 0.7);
            if (!confirm('Bán ' + player.name + ' với giá $' + (price/1e6).toFixed(2) + 'M?')) return;
            gameState.budget += price;
            gameState.squad.splice(idx, 1);
            // đưa vào market
            gameState.transferMarket.unshift({
                ...player,
                id: 80000 + Math.floor(Math.random()*10000),
                clubFrom: gameState.clubName,
                value: price,
                isStarting: false
            });
            if (selectedTacticsPlayerId === playerId) selectedTacticsPlayerId = null;
            alert('Đã bán ' + player.name + ' (+$' + (price/1e6).toFixed(2) + 'M)');
            saveGame();
            updateUI();
            renderTacticsTab();
            if (document.getElementById('tab-transfers') && !document.getElementById('tab-transfers').classList.contains('hidden')) {
                filterTransferMarket();
            }
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
            if (!canAddToSquad(1)) return;
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


        // ==================== 2D LIVE PITCH ACTORS ====================
        // Horizontal pitch: left = home goal, right = away goal
        const LIVE_FORMATIONS = {
            '4-3-3': [
                { pos: 'GK', x: 6, y: 50 },
                { pos: 'LB', x: 22, y: 18 }, { pos: 'CB', x: 20, y: 38 }, { pos: 'CB', x: 20, y: 62 }, { pos: 'RB', x: 22, y: 82 },
                { pos: 'CM', x: 38, y: 28 }, { pos: 'CM', x: 36, y: 50 }, { pos: 'CM', x: 38, y: 72 },
                { pos: 'LW', x: 58, y: 20 }, { pos: 'ST', x: 62, y: 50 }, { pos: 'RW', x: 58, y: 80 }
            ],
            '4-4-2': [
                { pos: 'GK', x: 6, y: 50 },
                { pos: 'LB', x: 22, y: 18 }, { pos: 'CB', x: 20, y: 38 }, { pos: 'CB', x: 20, y: 62 }, { pos: 'RB', x: 22, y: 82 },
                { pos: 'LM', x: 42, y: 18 }, { pos: 'CM', x: 40, y: 38 }, { pos: 'CM', x: 40, y: 62 }, { pos: 'RM', x: 42, y: 82 },
                { pos: 'ST', x: 60, y: 38 }, { pos: 'ST', x: 60, y: 62 }
            ],
            '4-2-3-1': [
                { pos: 'GK', x: 6, y: 50 },
                { pos: 'LB', x: 22, y: 18 }, { pos: 'CB', x: 20, y: 38 }, { pos: 'CB', x: 20, y: 62 }, { pos: 'RB', x: 22, y: 82 },
                { pos: 'CDM', x: 34, y: 35 }, { pos: 'CDM', x: 34, y: 65 },
                { pos: 'LW', x: 52, y: 18 }, { pos: 'CAM', x: 50, y: 50 }, { pos: 'RW', x: 52, y: 82 },
                { pos: 'ST', x: 64, y: 50 }
            ],
            '3-5-2': [
                { pos: 'GK', x: 6, y: 50 },
                { pos: 'CB', x: 20, y: 28 }, { pos: 'CB', x: 18, y: 50 }, { pos: 'CB', x: 20, y: 72 },
                { pos: 'LM', x: 40, y: 14 }, { pos: 'CM', x: 38, y: 35 }, { pos: 'CM', x: 36, y: 50 }, { pos: 'CM', x: 38, y: 65 }, { pos: 'RM', x: 40, y: 86 },
                { pos: 'ST', x: 60, y: 38 }, { pos: 'ST', x: 60, y: 62 }
            ],
            '5-3-2': [
                { pos: 'GK', x: 6, y: 50 },
                { pos: 'LB', x: 24, y: 12 }, { pos: 'CB', x: 18, y: 30 }, { pos: 'CB', x: 16, y: 50 }, { pos: 'CB', x: 18, y: 70 }, { pos: 'RB', x: 24, y: 88 },
                { pos: 'CM', x: 40, y: 30 }, { pos: 'CM', x: 38, y: 50 }, { pos: 'CM', x: 40, y: 70 },
                { pos: 'ST', x: 58, y: 38 }, { pos: 'ST', x: 58, y: 62 }
            ]
        };

        function getLiveFormationSlots(formationName) {
            const key = formationName || '4-3-3';
            return LIVE_FORMATIONS[key] || LIVE_FORMATIONS['4-3-3'];
        }

        function shortPlayerLabel(name) {
            if (!name) return '?';
            const parts = String(name).trim().split(/\s+/);
            return parts.length <= 1 ? parts[0].slice(0, 6) : parts[parts.length - 1].slice(0, 7);
        }

        function assignPlayersToSlots(players, slots) {
            const pool = (players || []).slice();
            const used = new Set();
            const assigned = [];
            slots.forEach((slot, i) => {
                let idx = pool.findIndex((p, j) => !used.has(j) && p.pos === slot.pos);
                if (idx < 0) {
                    // compatible groups
                    const groups = {
                        GK: ['GK'], CB: ['CB'], LB: ['LB','RB','CB'], RB: ['RB','LB','CB'],
                        CDM: ['CDM','CM'], CM: ['CM','CDM','CAM'], CAM: ['CAM','CM'],
                        LM: ['LM','LW','RM'], RM: ['RM','RW','LM'],
                        LW: ['LW','LM','ST'], RW: ['RW','RM','ST'], ST: ['ST','CAM','LW','RW']
                    };
                    const g = groups[slot.pos] || [slot.pos];
                    idx = pool.findIndex((p, j) => !used.has(j) && g.includes(p.pos));
                }
                if (idx < 0) idx = pool.findIndex((_, j) => !used.has(j));
                const p = idx >= 0 ? pool[idx] : { name: 'CT ' + (i + 1), pos: slot.pos, rating: 70 };
                if (idx >= 0) used.add(idx);
                assigned.push({ player: p, baseX: slot.x, baseY: slot.y, pos: slot.pos });
            });
            return assigned;
        }

        function mirrorAwaySlot(x, y) {
            return { x: 100 - x, y: y };
        }

        function initMatchPitchActors() {
            const homeSlots = getLiveFormationSlots(gameState.formation || '4-3-3');
            const awayFormationKeys = Object.keys(LIVE_FORMATIONS);
            const awayForm = awayFormationKeys[Math.floor(Math.random() * awayFormationKeys.length)];
            const awaySlots = getLiveFormationSlots(awayForm);
            try {
                const el = document.getElementById('sim-away-tactic');
                if (el) el.innerText = awayForm;
            } catch (_) {}

            const starters = gameState.squad.filter(p => p.isStarting).slice(0, 11);
            // Pad if needed
            while (starters.length < 11) {
                starters.push({ name: 'Dự bị ' + (starters.length + 1), pos: homeSlots[starters.length]?.pos || 'CM', rating: 68 });
            }
            const homeAssigned = assignPlayersToSlots(starters, homeSlots);

            // Fake away XI from opponent ovr
            const oppOvr = (matchSimState.opponent && matchSimState.opponent.ovr) || 72;
            const awayFake = awaySlots.map((s, i) => ({
                name: (matchSimState.opponent && matchSimState.opponent.name ? matchSimState.opponent.name.split(' ')[0] : 'Opp') + ' ' + (i + 1),
                pos: s.pos,
                rating: Math.max(60, Math.min(92, oppOvr + Math.floor(Math.random() * 7) - 3))
            }));
            // Prefer real-ish names from short labels only
            const awayAssigned = awaySlots.map((s, i) => ({
                player: awayFake[i],
                baseX: mirrorAwaySlot(s.x, s.y).x,
                baseY: mirrorAwaySlot(s.x, s.y).y,
                pos: s.pos
            }));

            matchSimState.pitchActors = {
                home: homeAssigned,
                away: awayAssigned,
                ref: { x: 50, y: 50 },
                ballX: 50,
                ballY: 50
            };

            const homeBox = document.getElementById('sim-home-dots');
            const awayBox = document.getElementById('sim-away-dots');
            const refBox = document.getElementById('sim-ref-dot');
            if (!homeBox || !awayBox || !refBox) return;

            homeBox.innerHTML = homeAssigned.map((a, i) => {
                const isGk = a.pos === 'GK';
                return '<div class="sim-player-dot home' + (isGk ? ' gk' : '') + '" data-side="home" data-idx="' + i + '" style="left:' + a.baseX + '%;top:' + a.baseY + '%" title="' + (a.player.name || '') + '">'
                    + (isGk ? 'GK' : String(i + 1))
                    + '<span class="sim-label">' + shortPlayerLabel(a.player.name) + '</span></div>';
            }).join('');

            awayBox.innerHTML = awayAssigned.map((a, i) => {
                const isGk = a.pos === 'GK';
                return '<div class="sim-player-dot away' + (isGk ? ' gk' : '') + '" data-side="away" data-idx="' + i + '" style="left:' + a.baseX + '%;top:' + a.baseY + '%" title="' + (a.player.name || '') + '">'
                    + (isGk ? 'GK' : String(i + 1))
                    + '<span class="sim-label">' + shortPlayerLabel(a.player.name) + '</span></div>';
            }).join('');

            refBox.innerHTML = '<div class="sim-ref-dot" id="sim-ref-actor" style="left:50%;top:48%"></div>';
        }

        function updateMatchPitchActors(ballLeftPct, ballTopPct) {
            if (!matchSimState || !matchSimState.pitchActors) return;
            const actors = matchSimState.pitchActors;
            const bx = ballLeftPct != null ? ballLeftPct : actors.ballX;
            const by = ballTopPct != null ? ballTopPct : actors.ballY;
            actors.ballX = bx;
            actors.ballY = by;

            const shiftTowardBall = (baseX, baseY, strength, side) => {
                // side home pushes a bit toward ball when ball on their half
                const dx = (bx - baseX) * strength;
                const dy = (by - baseY) * strength;
                let x = baseX + dx;
                let y = baseY + dy;
                // small random jitter
                x += (Math.random() - 0.5) * 2.2;
                y += (Math.random() - 0.5) * 2.2;
                x = Math.max(3, Math.min(97, x));
                y = Math.max(6, Math.min(94, y));
                return { x, y };
            };

            actors.home.forEach((a, i) => {
                const strength = a.pos === 'GK' ? 0.04 : (a.pos === 'ST' || a.pos === 'LW' || a.pos === 'RW' ? 0.18 : 0.12);
                const p = shiftTowardBall(a.baseX, a.baseY, strength, 'home');
                a.curX = p.x; a.curY = p.y;
                const el = document.querySelector('#sim-home-dots [data-idx="' + i + '"]');
                if (el) {
                    el.style.left = p.x + '%';
                    el.style.top = p.y + '%';
                }
            });
            actors.away.forEach((a, i) => {
                const strength = a.pos === 'GK' ? 0.04 : (a.pos === 'ST' || a.pos === 'LW' || a.pos === 'RW' ? 0.18 : 0.12);
                const p = shiftTowardBall(a.baseX, a.baseY, strength, 'away');
                a.curX = p.x; a.curY = p.y;
                const el = document.querySelector('#sim-away-dots [data-idx="' + i + '"]');
                if (el) {
                    el.style.left = p.x + '%';
                    el.style.top = p.y + '%';
                }
            });

            // Referee near ball but offset
            const rx = Math.max(8, Math.min(92, bx + (Math.random() - 0.5) * 12));
            const ry = Math.max(10, Math.min(90, by + (Math.random() - 0.5) * 14 + 6));
            actors.ref = { x: rx, y: ry };
            const refEl = document.getElementById('sim-ref-actor');
            if (refEl) {
                refEl.style.left = rx + '%';
                refEl.style.top = ry + '%';
            }
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

            // Báo cáo sức mạnh trước trận
            const xi = gameState.squad.filter(p => p.isStarting);
            const pw = getTeamMatchPower(xi);
            const oAtt = opponent.att || opponent.ovr;
            const oDef = opponent.def || opponent.ovr;
            const oMid = opponent.mid != null ? opponent.mid : opponent.ovr;
            addCommentary(
                `<div class="text-sky-300 text-xs">[Phân tích] ${gameState.clubName}: ATT ${pw.att.toFixed(0)} · MID ${pw.mid.toFixed(0)} · DEF ${pw.def.toFixed(0)} · OVR ${pw.ovr.toFixed(0)}`
                + `  vs  ${opponent.name}: ATT ${Number(oAtt).toFixed(0)} · MID ${Number(oMid).toFixed(0)} · DEF ${Number(oDef).toFixed(0)} · OVR ${Number(opponent.ovr).toFixed(0)}</div>`
            );
            const edge = pw.ovr - (opponent.ovr || 70);
            if (edge >= 6) addCommentary(`<div class="text-emerald-400 text-xs">[Dự đoán] Đội bạn mạnh hơn rõ (~+${edge.toFixed(0)} OVR) — xác suất thắng cao.</div>`);
            else if (edge <= -6) addCommentary(`<div class="text-amber-400 text-xs">[Dự đoán] Đối thủ mạnh hơn (~${edge.toFixed(0)} OVR) — cần đá chắc.</div>`);
            else addCommentary(`<div class="text-slate-400 text-xs">[Dự đoán] Hai đội ngang tầm — trận có thể giằng co.</div>`);

            AudioFX.whistle();
            initMatchPitchActors();
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
                let ballX = 50, ballY = 50;
                if (ball) {
                    ballX = Math.floor(Math.random() * 80) + 10;
                    ballY = Math.floor(Math.random() * 70) + 15;
                    ball.style.left = ballX + '%';
                    ball.style.top = ballY + '%';
                }
                try { updateMatchPitchActors(ballX, ballY); } catch (_) {}

                const starters = gameState.squad.filter(p => p.isStarting);
                const power = getTeamMatchPower(starters);
                let myAtt = power.att;
                let myMid = power.mid;
                let myDef = power.def;
                // Tâm lý trận
                if (matchSimState.mentality === 'ATTACK') { myAtt += 4; myMid += 1; myDef -= 4; }
                if (matchSimState.mentality === 'DEFEND') { myAtt -= 3; myDef += 5; myMid -= 1; }
                // Phong cách chiến thuật
                const style = gameState.tacticStyle || 'balanced';
                if (style === 'attacking' || style === 'tiki-taka') { myAtt += 2; myMid += 2; }
                if (style === 'defensive' || style === 'counter') { myDef += 2; myAtt += (style === 'counter' ? 1 : -1); }
                // Thời tiết
                if (gameState.weather === 'Mưa' || gameState.weather === 'Mưa nhẹ') {
                    myAtt -= 2; myMid -= 1; myDef -= 1;
                }
                // Thể lực giảm dần theo phút
                const fatigue = 1 - (matchSimState.minute / 90) * 0.08;
                myAtt *= fatigue; myMid *= fatigue; myDef *= fatigue;

                const oppOvr = matchSimState.opponent.ovr || 72;
                let oppAtt = matchSimState.opponent.att || oppOvr;
                let oppMid = (matchSimState.opponent.mid != null) ? matchSimState.opponent.mid : oppOvr;
                let oppDef = matchSimState.opponent.def || oppOvr;
                // Biến thiên nhẹ mỗi trận
                if (!matchSimState._oppJitter) {
                    matchSimState._oppJitter = {
                        att: (Math.random() * 4 - 2),
                        mid: (Math.random() * 4 - 2),
                        def: (Math.random() * 4 - 2)
                    };
                }
                oppAtt += matchSimState._oppJitter.att;
                oppMid += matchSimState._oppJitter.mid;
                oppDef += matchSimState._oppJitter.def;

                // Kiểm soát bóng từ midfield
                const posHome = Math.round(100 * myMid / (myMid + oppMid + 0.01));
                const posAway = 100 - posHome;
                if (matchSimState.minute % 5 === 0 || matchSimState.minute <= 2) {
                    try {
                        document.getElementById('stat-pos-home').innerText = posHome + '%';
                        document.getElementById('stat-pos-away').innerText = posAway + '%';
                    } catch (_) {}
                }

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
                        const bench = gameState.squad.filter(p => !p.isStarting && (!p.injuryWeeks || p.injuryWeeks <= 0));
                        if (bench.length && matchSimState.subsUsed < 3) {
                            bench.sort((a,b) => effectiveRating(b) - effectiveRating(a));
                            const sub = bench[0];
                            sub.isStarting = true;
                            matchSimState.subsUsed++;
                            document.getElementById('subs-left').innerText = 3 - matchSimState.subsUsed;
                            addCommentary(`<span class="text-indigo-300">[${matchSimState.minute}'] ${sub.name} vào thay thế.</span>`);
                        }
                    }
                } else if (eventRoll < 0.18) {
                    // Cơ hội tấn công: đội mạnh (mid + att) chiếm nhiều pha bóng hơn
                    const homeAttackWeight = Math.pow(Math.max(1, myMid * 0.55 + myAtt * 0.45), 1.35);
                    const awayAttackWeight = Math.pow(Math.max(1, oppMid * 0.55 + oppAtt * 0.45), 1.35);
                    const homeChance = homeAttackWeight / (homeAttackWeight + awayAttackWeight);
                    const attackingTeam = Math.random() < homeChance ? 'HOME' : 'AWAY';
                    if (attackingTeam === 'HOME') {
                        matchSimState.homeShots++;
                        // Scorer ưu tiên OVR cao ở hàng công
                        let scorers = starters.filter(p => ['ST','CF','CAM','RW','LW','CM'].includes(p.pos));
                        if (!scorers.length) scorers = starters.slice();
                        scorers.sort((a,b) => effectiveRating(b) - effectiveRating(a));
                        // Weighted pick: top players more likely
                        let pick = 0;
                        const r = Math.random();
                        if (r < 0.45) pick = 0;
                        else if (r < 0.75) pick = Math.min(1, scorers.length - 1);
                        else pick = Math.floor(Math.random() * scorers.length);
                        const scorer = scorers[pick];
                        const isHighlight = Math.random() < 0.22 + Math.max(0, (myAtt - oppDef) / 80);
                        // Goal chance phụ thuộc ATT vs DEF đối phương — đội mạnh ghi nhiều hơn rõ rệt
                        let goalChance = strengthToProb(myAtt, oppDef, 0.28, 8.5);
                        // Scorer cá nhân
                        goalChance += (effectiveRating(scorer) - 75) * 0.006;
                        goalChance = Math.max(0.05, Math.min(0.68, goalChance));
                        if (isHighlight) {
                            const hl = HIGHLIGHTS[Math.floor(Math.random()*4)];
                            goalChance = Math.min(0.72, goalChance + 0.08);
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
                        let awayGoalChance = strengthToProb(oppAtt, myDef, 0.28, 8.5);
                        awayGoalChance = Math.max(0.05, Math.min(0.68, awayGoalChance));
                        if (Math.random() < awayGoalChance) {
                            if (Math.random() < 0.12) {
                                const gk = starters.find(p => p.pos === 'GK');
                                addCommentary(`[${matchSimState.minute}'] 🧤 ${gk ? gk.name : 'Thủ môn'} cứu thua xuất thần! (OVR ${gk ? effectiveRating(gk) : '?'})`);
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

                // Cập nhật possession từ mid (đã set ở trên) + shots
                try {
                    document.getElementById('stat-shots-home').innerText = matchSimState.homeShots;
                    document.getElementById('stat-shots-away').innerText = matchSimState.awayShots;
                    document.getElementById('stat-fouls-home').innerText = matchSimState.homeFouls;
                    document.getElementById('stat-fouls-away').innerText = matchSimState.awayFouls;
                } catch (_) {}
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

            let loaded = null;
            // 1) Cloud ưu tiên (đồng bộ giữa máy / sau khi update code)
            try {
                const cloud = await loadGameCloud();
                if (cloud && cloud.clubName && !cloud.reset) loaded = cloud;
            } catch (e) { console.warn(e); }

            // 2) Local fallback
            if (!loaded) {
                try {
                    const local = localStorage.getItem('fm_game_save_v2');
                    if (local) {
                        const data = JSON.parse(local);
                        if (data.clubName) loaded = data;
                    }
                } catch (_) {}
            }

            if (loaded) {
                Object.assign(gameState, loaded);
                ensureGameExtras();
                syncMergeRatesFromAdmin(settings); // ghi đè tỉ lệ cũ trong save
                ensureTransferMarket();
                await applyPendingGifts();
                // Đồng bộ lại cloud ngay sau khi load local (phòng cloud trống)
                scheduleCloudSave();
                document.getElementById('club-mode-modal')?.classList.add('hidden');
                document.getElementById('club-select-modal')?.classList.add('hidden');
                updateUI();
                return;
            }

            if (settings.allowCustomClubs === false) {
                document.getElementById('btn-custom-club')?.classList.add('opacity-40', 'pointer-events-none');
            }
            syncMergeRatesFromAdmin(settings);
            document.getElementById('club-mode-modal')?.classList.remove('hidden');
            try { initGame(); } catch (_) {}
        }

        // Override confirmStartGame to also save profile
        function confirmStartGamePatched() {
            const club = getClubsForLeague(selectedLeagueId).find(c => c.id === selectedClubId);
            if (!club) return;
            startWithClub(club, selectedLeagueId);
        }
        window.confirmStartGame = confirmStartGamePatched;

        // Cloud save: handled inside saveGame() via scheduleCloudSave


        // Boot immediately (module may load after window.onload already fired)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => bootApp());
        } else {
            bootApp();
        }


    

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
  window.clearTransferFilters = clearTransferFilters;
  window.populateTransferFilterOptions = populateTransferFilterOptions;
  window.buyPlayer = buyPlayer;
  window.sellPlayer = sellPlayer;
  window.sellCard = sellCard;
  window.listPlayerOnMarket = listPlayerOnMarket;
  window.releasePlayer = releasePlayer;
  window.buyPlayerCard = buyPlayerCard;
  window.buyGuaranteedCard = buyGuaranteedCard;
  window.mergeCards = mergeCards;
  window.addPlayerFromCard = addPlayerFromCard;
  window.saveCurrentSquadPreset = saveCurrentSquadPreset;
  window.loadSquadPreset = loadSquadPreset;
  window.setMatchdayRole = setMatchdayRole;
  window.generateTransferMarket = generateTransferMarket;
  window.ensureTransferMarket = ensureTransferMarket;
  window.placePlayerInSlot = placePlayerInSlot;
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
  window.saveGame = saveGameManual;
  window.saveGameSilent = saveGame;
  window.resetGamePrompt = resetGamePrompt;
} catch(e) { console.warn('expose', e); }
