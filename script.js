// ====== CONFIGURAÇÃO GERAL E ESTADO ====== //
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const startScreen = document.getElementById('start-screen');
const triviaModal = document.getElementById('trivia-modal');
const gameOverScreen = document.getElementById('game-over-screen');

// Valores de HUD
const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speed');
const safetyBar = document.getElementById('safety-bar');
const safetyText = document.getElementById('safety-text');
const finalScoreSpan = document.querySelector('#final-score-display span');

let gameState = 'start'; // 'start', 'playing', 'trivia', 'gameover'
let score = 0;
let speed = 100; 
let baseSpeed = 100;
let maxSpeed = 300;
let safetyRating = 100;
let distanceCounter = 0; // para triggar trivia
const triviaDistance = 1500; // a cada 1500 pontos de viagem, pit stop!

let reqAnimFrame;
let lastFrameTime = performance.now();
const lanes = [50, 150, 250, 350]; // Centros aproximados das 4 pistas virtuais

// Botões
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

// ====== CONTROLES ====== //
const keys = { ArrowLeft: false, ArrowRight: false, a: false, d: false };
document.addEventListener('keydown', (e) => {
    if(keys.hasOwnProperty(e.key) || e.key === 'a' || e.key === 'd') {
        const key = e.key === 'a' ? 'ArrowLeft' : (e.key === 'd' ? 'ArrowRight' : e.key);
        keys[key] = true;
    }
});
document.addEventListener('keyup', (e) => {
    if(keys.hasOwnProperty(e.key) || e.key === 'a' || e.key === 'd') {
        const key = e.key === 'a' ? 'ArrowLeft' : (e.key === 'd' ? 'ArrowRight' : e.key);
        keys[key] = false;
    }
});

// ====== OBJETOS DO JOGO ====== //
const player = {
    x: 200,
    y: 550,
    width: 36,
    height: 70,
    color: '#e10600',
    speedX: 0,
    maxSpeedX: 300,
    friction: 0.9,
    draw: function() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Sombra
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(-this.width/2 + 5, -this.height/2 + 5, this.width, this.height);
        
        // Corpo central
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(-this.width/2 + 4, -this.height/2, this.width - 8, this.height, 5);
        ctx.fill();
        
        // Pneus
        ctx.fillStyle = "#111"; // Escuro
        ctx.fillRect(-this.width/2 - 2, -this.height/2 + 10, 8, 16); // Esq Tras
        ctx.fillRect(this.width/2 - 6, -this.height/2 + 10, 8, 16);  // Dir Tras
        ctx.fillRect(-this.width/2 - 2, this.height/2 - 20, 8, 16);  // Esq Frent
        ctx.fillRect(this.width/2 - 6, this.height/2 - 20, 8, 16);   // Dir Frent
        
        // Asas
        ctx.fillStyle = "#fff";
        ctx.fillRect(-this.width/2, this.height/2 - 5, this.width, 10); // Asa Frontal
        ctx.fillRect(-this.width/2, -this.height/2, this.width, 10); // Asa traseira
        
        // Piloto (Capacete)
        ctx.fillStyle = "#ffd700";
        ctx.beginPath();
        ctx.arc(0, 5, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    },
    update: function(dt) {
        // Movimento
        if (keys.ArrowLeft) this.speedX -= 1500 * dt;
        if (keys.ArrowRight) this.speedX += 1500 * dt;
        
        // Atrito / Inércia
        this.speedX *= this.friction;
        
        // Limite Velocidade Lateral
        if(this.speedX > this.maxSpeedX) this.speedX = this.maxSpeedX;
        if(this.speedX < -this.maxSpeedX) this.speedX = -this.maxSpeedX;

        this.x += this.speedX * dt;

        // Borda da tela
        if (this.x < 25) {
            this.x = 25;
            this.speedX = 0;
        }
        if (this.x > canvas.width - 25) {
            this.x = canvas.width - 25;
            this.speedX = 0;
        }
    }
};

let entities = [];
let roadOffset = 0;
let particleSystem = [];

// ======= CLASSES DE ENTIDADES ======= //
class Entity {
    constructor(type, x, y, width, height, velocityY) {
        this.type = type; // 'hazard', 'bonus'
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.velocityY = velocityY;
        this.markedForDeletion = false;
        // visual
        this.color = type === 'hazard' ? '#ff3333' : '#00ff41';
        if(type === 'hazard') {
            this.subType = Math.random() > 0.5 ? 'car' : 'puddle';
            if(this.subType === 'puddle') { this.color = '#33ccff'; this.width = 40; this.height = 40; }
        } else {
            this.subType = 'shield';
        }
    }
    
    update(dt) {
        this.y += (this.velocityY + speed) * dt;
        if (this.y > canvas.height + 100) this.markedForDeletion = true;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (this.type === 'hazard') {
            if (this.subType === 'car') {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.roundRect(-this.width/2, -this.height/2, this.width, this.height, 4);
                ctx.fill();
                ctx.fillStyle = '#111';
                ctx.fillRect(-this.width/2+4, -this.height/2+8, this.width-8, 12);
                ctx.fillRect(-this.width/2+4, this.height/2-20, this.width-8, 12);
            } else {
                ctx.fillStyle = this.color;
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.ellipse(0, 0, this.width/2, this.height/2, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        } else {
            ctx.fillStyle = '#00ff41';
            ctx.shadowColor = '#00ff41';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, this.width/2, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '20px Oswald';
            ctx.fillText('+', 0, 2);
        }
        
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.color = color;
        this.size = Math.random() * 5 + 2;
        this.speedX = Math.random() * 200 - 100;
        this.speedY = Math.random() * 200 - 100;
        this.life = 1.0;
    }
    update(dt) {
        this.x += this.speedX * dt;
        this.y += this.speedY * dt;
        this.life -= dt * 2;
    }
    draw() {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// ====== LÓGICA DE SPAWN ====== //
let spawnTime = 0;
let nextSpawn = 1.5;

function handleSpawners(dt) {
    spawnTime += dt;
    if (spawnTime >= nextSpawn && gameState === 'playing') {
        spawnTime = 0;
        nextSpawn = Math.max(0.4, 2.0 - (score / 3000));
        
        let lane = lanes[Math.floor(Math.random() * lanes.length)];
        let isBonus = Math.random() < 0.2;
        
        if (isBonus) {
            entities.push(new Entity('bonus', lane, -50, 24, 24, 50));
        } else {
            let obsSpeed = Math.random() * 50; 
            entities.push(new Entity('hazard', lane, -50, 40, 75, obsSpeed));
        }
    }
}

// ======= COLISÕES ======= //
function checkCollisions() {
    let pLeft = player.x - player.width/2 + 5;
    let pRight = player.x + player.width/2 - 5;
    let pTop = player.y - player.height/2 + 5;
    let pBot = player.y + player.height/2 - 5;

    entities.forEach(entity => {
        if(entity.markedForDeletion) return;
        
        let eLeft = entity.x - entity.width/2;
        let eRight = entity.x + entity.width/2;
        let eTop = entity.y - entity.height/2;
        let eBot = entity.y + entity.height/2;
        
        if (pLeft < eRight && pRight > eLeft && pTop < eBot && pBot > eTop) {
            entity.markedForDeletion = true;
            createExplosion(entity.x, entity.y, entity.color);
            
            if(entity.type === 'hazard') {
                takeDamage(20);
                speed = baseSpeed;
            } else {
                healDamage(10);
                score += 50;
            }
        }
    });
}

function takeDamage(amount) {
    safetyRating -= amount;
    updateHUD();
    if(safetyRating <= 0) {
        gameOver();
    }
}

function healDamage(amount) {
    safetyRating += amount;
    if(safetyRating > 100) safetyRating = 100;
    updateHUD();
}

function createExplosion(x, y, color) {
    for(let i=0; i<15; i++) {
        particleSystem.push(new Particle(x, y, color));
    }
}

// ====== CICLO PRINCIPAL ====== //
function startGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    triviaModal.classList.add('hidden');
    hud.classList.remove('hidden');
    
    gameState = 'playing';
    score = 0;
    speed = baseSpeed;
    safetyRating = 100;
    distanceCounter = 0;
    entities = [];
    particleSystem = [];
    player.x = canvas.width / 2;
    player.speedX = 0;
    
    updateHUD();
    
    lastFrameTime = performance.now() / 1000;
    reqAnimFrame = requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    const now = timestamp / 1000;
    let dt = now - lastFrameTime;
    lastFrameTime = now;
    
    if (dt > 0.1) dt = 0.016; 
    
    if (gameState === 'playing') {
        updateGame(dt);
    }
    
    drawGame(dt);
    
    if(gameState === 'playing' || gameState === 'trivia') {
        reqAnimFrame = requestAnimationFrame(gameLoop);
    }
}

function updateGame(dt) {
    score += (speed * dt) / 5;
    distanceCounter += speed * dt;
    speed += 5 * dt;
    if (speed > maxSpeed) speed = maxSpeed;
    
    player.update(dt);
    
    handleSpawners(dt);
    entities.forEach(e => e.update(dt));
    particleSystem.forEach(p => p.update(dt));
    
    entities = entities.filter(e => !e.markedForDeletion);
    particleSystem = particleSystem.filter(p => p.life > 0);
    
    checkCollisions();
    updateHUD();
    
    if (distanceCounter >= triviaDistance && gameState === 'playing') {
        distanceCounter = 0;
        initTrivia();
    }
}

function drawGame(dt) {
    ctx.fillStyle = "#1e1e24";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    roadOffset += speed * dt * 2;
    if (roadOffset > 100) roadOffset = 0;
    
    ctx.fillStyle = "#fff";
    for(let i=-2; i < canvas.height/100 + 2; i++) {
        let y = i * 100 + roadOffset;
        ctx.fillRect(canvas.width * 0.25 - 2, y, 4, 40);
        ctx.fillRect(canvas.width * 0.5 - 2, y, 4, 40);
        ctx.fillRect(canvas.width * 0.75 - 2, y, 4, 40);
    }

    for(let i=-2; i < canvas.height/40 + 2; i++) {
        let y = i * 40 + (roadOffset % 40) * 1.5;
        ctx.fillStyle = i % 2 === 0 ? '#e10600' : '#fff'; // Red/White curbs
        ctx.fillRect(0, y, 15, 40);
        ctx.fillRect(canvas.width - 15, y, 15, 40);
    }
    
    entities.forEach(e => e.draw());
    player.draw();
    particleSystem.forEach(p => p.draw());
    
    // Dano Visual
    if(safetyRating < 100 && gameState === 'playing') {
        let alpha = (100 - safetyRating) / 200; // max 0.5 overlay vermelho suave constante se danificado
        ctx.fillStyle = `rgba(225, 6, 0, ${alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function gameOver() {
    gameState = 'gameover';
    hud.classList.add('hidden');
    finalScoreSpan.innerText = Math.floor(score);
    gameOverScreen.classList.remove('hidden');
}

function updateHUD() {
    scoreEl.innerText = Math.floor(score).toLocaleString('pt-BR');
    speedEl.innerText = Math.floor(speed);
    
    safetyBar.style.width = Math.max(0, safetyRating) + '%';
    safetyText.innerText = Math.max(0, Math.floor(safetyRating)) + '%';
    
    if (safetyRating > 60) {
        safetyBar.style.backgroundPosition = "100% 0"; 
        safetyText.style.color = "#00ff41";
    } else if (safetyRating > 30) {
        safetyBar.style.backgroundPosition = "50% 0"; 
        safetyText.style.color = "#ffff00";
    } else {
        safetyBar.style.backgroundPosition = "0% 0"; 
        safetyText.style.color = "#e10600";
    }
}

// ======= PIT STOP TRIVIA ======= //
const questions = [
    {
        q: "Ao cruzar com um semáforo amarelo piscante contínuo à noite, o que fazer?",
        options: [
            "Acelerar, de noite não há perigo.",
            "Reduzir a velocidade e cruzar com atenção redobrada.",
            "Parar completamente e esperar ficar verde.",
            "Avançar buzinando rápido."
        ],
        answer: 1
    },
    {
        q: "Qual a distância segura para o veículo da frente em dias normais?",
        options: [
            "Pelo menos 1 segundo.",
            "A regra preventiva dos 2 segundos livres.",
            "Só me preocupo na chuva forte.",
            "Colar atrás para pegar o vácuo esportivo."
        ],
        answer: 1
    },
    {
        q: "Usar o celular no trânsito parado no semáforo...",
        options: [
            "Pode para checar mapas rapidamente.",
            "É infração gravíssima, tira seu maior ativo: a atenção.",
            "Só é infração acima de 40km/h.",
            "Mantém o condutor acordado portanto é recomendável."
        ],
        answer: 1
    },
    {
        q: "Qual a filosofia da 'Direção Defensiva'?",
        options: [
            "Pilotar um tanque blindado nas ruas.",
            "Dirigir prevendo cenários para evitar acidentes ativamente.",
            "Sempre ultrapassar primeiro evitando ficar para trás.",
            "Buzinar sempre que se sentir ameaçado por outro motorista."
        ],
        answer: 1
    }
];

let triviaTimeLeft = 10;
let triviaInterval;

function initTrivia() {
    gameState = 'trivia';
    speed = baseSpeed; 
    
    const rootTimerBar = document.getElementById('trivia-timer-bar');
    rootTimerBar.style.width = '100%';
    rootTimerBar.style.backgroundColor = '#ffd700';

    const qBank = questions[Math.floor(Math.random() * questions.length)];
    document.getElementById('trivia-question').innerText = qBank.q;
    
    const optionsContainer = document.getElementById('trivia-options');
    optionsContainer.innerHTML = '';
    
    qBank.options.forEach((optText, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = optText;
        btn.onclick = () => handleTriviaAnswer(index, qBank.answer, btn);
        optionsContainer.appendChild(btn);
    });

    triviaModal.classList.remove('hidden');
    
    triviaTimeLeft = 10;
    triviaInterval = setInterval(() => {
        triviaTimeLeft -= 0.1;
        const pct = (triviaTimeLeft / 10) * 100;
        rootTimerBar.style.width = pct + '%';
        if(pct < 30) rootTimerBar.style.backgroundColor = '#e10600';
        
        if(triviaTimeLeft <= 0) {
            clearInterval(triviaInterval);
            handleTriviaAnswer(-1, qBank.answer, null);
        }
    }, 100);
}

function handleTriviaAnswer(selectedIndex, correctIndex, btnElement) {
    clearInterval(triviaInterval);
    
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => b.onclick = null);
    
    if(btns[correctIndex]) btns[correctIndex].classList.add('correct');
    
    let acertou = (selectedIndex === correctIndex);
    if(!acertou && selectedIndex !== -1 && btnElement) {
        btnElement.classList.add('wrong');
    }
    
    if (acertou) {
        healDamage(30);
        score += 300;
        createExplosion(player.x, player.y - 50, '#00ff41'); 
    } else {
        takeDamage(30);
        for(let i=0; i<30; i++) particleSystem.push(new Particle(player.x, player.y, '#111'));
    }
    
    updateHUD();
    
    setTimeout(() => {
        triviaModal.classList.add('hidden');
        if(safetyRating > 0) {
            gameState = 'playing';
            entities = []; // Limpa tela logo após pit stop
        }
    }, 2000);
}

