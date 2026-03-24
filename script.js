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

// Sistema de Garagem e Moedas
let coins = parseInt(localStorage.getItem('f1_coins')) || 0;
let currentCarIndex = parseInt(localStorage.getItem('f1_current_car')) || 0;
let ownedCars = JSON.parse(localStorage.getItem('f1_owned_cars')) || [0]; // Index dos carros já comprados

const carModels = [
    { name: "Eco Sedan", color: "#4caf50", price: 0, speedMult: 1.0 },
    { name: "Urban Hatch", color: "#2196f3", price: 500, speedMult: 1.2 },
    { name: "Family SUV", color: "#ffeb3b", price: 1200, speedMult: 1.3 },
    { name: "Sport Coupé", color: "#9c27b0", price: 2500, speedMult: 1.6 },
    { name: "Classic GT", color: "#795548", price: 5000, speedMult: 1.9 },
    { name: "Hyper Car", color: "#607d8b", price: 8000, speedMult: 2.2 },
    { name: "Ultimate F1", color: "#e10600", price: 15000, speedMult: 2.8 }
];

let trafficLightState = 'none'; // 'none', 'green', 'yellow', 'red'
let trafficMsg = "";
let trafficMsgColor = "#fff";
let nextLightThreshold = 2000; 
let lastFrameTime = performance.now();
const lanes = [50, 150, 250, 350]; // Centros aproximados das 4 pistas virtuais

// Botões
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

// ====== CONTROLES ====== //
const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, a: false, d: false, w: false, s: false };

function handleKey(e, isDown) {
    let k = e.key;
    if (k === 'a' || k === 'ArrowLeft') keys.ArrowLeft = isDown;
    if (k === 'd' || k === 'ArrowRight') keys.ArrowRight = isDown;
    if (k === 'w' || k === 'ArrowUp') keys.ArrowUp = isDown;
    if (k === 's' || k === 'ArrowDown') keys.ArrowDown = isDown;
}

document.addEventListener('keydown', (e) => handleKey(e, true));
document.addEventListener('keyup', (e) => handleKey(e, false));

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
    updateStyle: function() {
        const model = carModels[currentCarIndex];
        this.color = model.color;
        this.maxSpeedX = 300 * model.speedMult;
    },
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
        const model = carModels[currentCarIndex];
        
        // Movimento Lateral
        if (keys.ArrowLeft) this.speedX -= 1500 * dt;
        if (keys.ArrowRight) this.speedX += 1500 * dt;
        this.speedX *= this.friction;
        
        // Movimento Vertical (Acelerar e Ré)
        if (gameState === 'playing' && trafficLightState === 'none') {
            if (keys.ArrowUp) {
                speed += 200 * dt; // Aceleração manual
            } else if (keys.ArrowDown) {
                speed -= 400 * dt; // Ré / Freio
            } else {
                speed -= 50 * dt; // Desaceleração natural
            }
            
            // Limites de velocidade
            if (speed > maxSpeed * model.speedMult) speed = maxSpeed * model.speedMult;
            if (speed < -50) speed = -50; // Velocidade de ré limitada
        } else if (trafficLightState !== 'none') {
            speed *= 0.9; // Para suavemente no semáforo
        }

        this.x += this.speedX * dt;

        // Limite Velocidade Lateral
        if(this.speedX > this.maxSpeedX) this.speedX = this.maxSpeedX;
        if(this.speedX < -this.maxSpeedX) this.speedX = -this.maxSpeedX;

        // Borda da tela
        if (this.x < 35) { this.x = 35; this.speedX = 0; }
        if (this.x > canvas.width - 35) { this.x = canvas.width - 35; this.speedX = 0; }
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
    document.getElementById('garage-screen').classList.add('hidden');
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
    player.updateStyle();
    
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
    if (speed > 0) {
        score += (speed * dt) / 5;
        distanceCounter += speed * dt;
        
        if (Math.floor(distanceCounter / 100) > Math.floor((distanceCounter - speed * dt) / 100)) {
            coins += 5;
        }
    }
    
    player.update(dt);
    
    // Lógica do Semáforo
    if (distanceCounter >= nextLightThreshold && trafficLightState === 'none') {
        startTrafficLightSequence();
    }
    
    handleSpawners(dt);
    
    if (trafficLightState !== 'none') {
        speed = 0; // Para o carro no semáforo
    }

    handleSpawners(dt);
    entities.forEach(e => e.update(dt));
    particleSystem.forEach(p => p.update(dt));
    
    entities = entities.filter(e => !e.markedForDeletion);
    particleSystem = particleSystem.filter(p => p.life > 0);
    
    checkCollisions();
    updateHUD();
}

function startTrafficLightSequence() {
    trafficLightState = 'yellow';
    distanceCounter = 0;
    nextLightThreshold = 3000 + Math.random() * 2000;
    
    initTrivia(true); // Trivia especial de semáforo
}

function drawGame(dt) {
    ctx.fillStyle = "#1e1e24";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Desenho da Rua com calçadas (visual urbano)
    ctx.fillStyle = "#333";
    ctx.fillRect(20, 0, canvas.width - 40, canvas.height);
    
    roadOffset += (speed || 100) * dt * 2; // Mantém movimento visual mínimo
    if (roadOffset > 100) roadOffset = 0;
    
    ctx.fillStyle = "#fff";
    for(let i=-2; i < canvas.height/100 + 2; i++) {
        let y = i * 100 + roadOffset;
        ctx.fillRect(canvas.width * 0.5 - 2, y, 4, 40);
    }
    
    // Calçadas
    ctx.fillStyle = "#555";
    ctx.fillRect(0, 0, 20, canvas.height);
    ctx.fillRect(canvas.width - 20, 0, 20, canvas.height);

    // Semáforo Visual
    if (trafficLightState !== 'none') {
        drawTrafficLight();
        
        // Mensagem de Instrução Centralizada
        if (trafficMsg !== "") {
            ctx.font = "bold 40px Oswald";
            ctx.textAlign = "center";
            ctx.fillStyle = trafficMsgColor;
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 4;
            ctx.strokeText(trafficMsg, canvas.width / 2, canvas.height / 2 - 150);
            ctx.fillText(trafficMsg, canvas.width / 2, canvas.height / 2 - 150);
        }
    }
    
    entities.forEach(e => e.draw());
    player.draw();
    particleSystem.forEach(p => p.draw());
}

function drawTrafficLight() {
    ctx.fillStyle = "#111";
    ctx.fillRect(canvas.width - 60, 100, 40, 100);
    
    // Luz Red
    ctx.fillStyle = trafficLightState === 'red' ? '#ff0000' : '#300';
    ctx.beginPath(); ctx.arc(canvas.width - 40, 115, 12, 0, Math.PI*2); ctx.fill();
    // Luz Yellow
    ctx.fillStyle = trafficLightState === 'yellow' ? '#ffff00' : '#330';
    ctx.beginPath(); ctx.arc(canvas.width - 40, 150, 12, 0, Math.PI*2); ctx.fill();
    // Luz Green
    ctx.fillStyle = trafficLightState === 'green' ? '#00ff00' : '#030';
    ctx.beginPath(); ctx.arc(canvas.width - 40, 185, 12, 0, Math.PI*2); ctx.fill();
}

function gameOver() {
    gameState = 'gameover';
    hud.classList.add('hidden');
    const earnedCoins = Math.floor(score / 10);
    coins += earnedCoins;
    localStorage.setItem('f1_coins', coins);
    
    finalScoreSpan.innerText = Math.floor(score);
    document.getElementById('earned-coins').innerText = earnedCoins;
    document.getElementById('total-coins-display').innerText = coins;
    gameOverScreen.classList.remove('hidden');
}

function updateHUD() {
    scoreEl.innerText = Math.floor(score).toLocaleString('pt-BR');
    speedEl.innerText = Math.floor(speed);
    document.getElementById('hud-coins').innerText = coins;
    
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
        q: "O semáforo ficou AMARELO. Qual a atitude correta?",
        options: [
            "Acelerar para passar antes do vermelho.",
            "Frear bruscamente no meio do cruzamento.",
            "Diminuir a marcha e parar com segurança, se possível.",
            "Buzinar para que os outros saiam da frente."
        ],
        answer: 2,
        type: 'light-yellow'
    },
    {
        q: "O semáforo está VERMELHO. Você pode avançar se não houver carros vindo?",
        options: [
            "Sim, se for de madrugada.",
            "Nunca, o sinal vermelho exige parada obrigatória.",
            "Sim, se estiver com muita pressa.",
            "Apenas se for virar à direita."
        ],
        answer: 1,
        type: 'light-red'
    },
    {
        q: "Qual a filosofia da 'Direção Defensiva'?",
        options: [
            "Pilotar um tanque blindado nas ruas.",
            "Dirigir prevendo cenários para evitar acidentes ativamente.",
            "Sempre ultrapassar primeiro evitando ficar para trás.",
            "Buzinar sempre que se sentir ameaçado."
        ],
        answer: 1
    }
];

let usedQuestions = [];
let triviaTimeLeft = 20; 
let triviaInterval;

function initTrivia(isLightEvent = false) {
    gameState = 'trivia';
    
    const rootTimerBar = document.getElementById('trivia-timer-bar');
    rootTimerBar.style.width = '100%';
    rootTimerBar.style.backgroundColor = '#ffd700';

    let qBank;
    if (isLightEvent) {
        // Seleciona pergunta de semáforo
        const lightQuestions = questions.filter(q => q.type && q.type.startsWith('light'));
        qBank = lightQuestions[Math.floor(Math.random() * lightQuestions.length)];
    } else {
        let availableQuestions = questions.filter((q, idx) => !usedQuestions.includes(idx) && !q.type);
        if (availableQuestions.length === 0) {
            usedQuestions = [];
            availableQuestions = questions.filter(q => !q.type);
        }
        const randomIdx = Math.floor(Math.random() * availableQuestions.length);
        qBank = availableQuestions[randomIdx];
        usedQuestions.push(questions.indexOf(qBank));
    }

    document.getElementById('trivia-question').innerText = qBank.q;
    
    const optionsContainer = document.getElementById('trivia-options');
    optionsContainer.innerHTML = '';
    
    qBank.options.forEach((optText, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = optText;
        btn.onclick = () => handleTriviaAnswer(index, qBank.answer, btn, isLightEvent);
        optionsContainer.appendChild(btn);
    });

    triviaModal.classList.remove('hidden');
    
    triviaTimeLeft = 20;
    triviaInterval = setInterval(() => {
        triviaTimeLeft -= 0.1;
        const pct = (triviaTimeLeft / 20) * 100;
        rootTimerBar.style.width = pct + '%';
        if(pct < 30) rootTimerBar.style.backgroundColor = '#e10600';
        
        if(triviaTimeLeft <= 0) {
            clearInterval(triviaInterval);
            handleTriviaAnswer(-1, qBank.answer, null, isLightEvent);
        }
    }, 100);
}

function handleTriviaAnswer(selectedIndex, correctIndex, btnElement, isLightEvent) {
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
        coins += 250; // Bônus de acerto maior
        if(isLightEvent) {
            trafficLightState = 'green';
            trafficMsg = "PODE PASSAR";
            trafficMsgColor = "#00ff00";
        }
    } else {
        takeDamage(30);
        if(isLightEvent) {
            trafficLightState = 'red';
            trafficMsg = "PARE";
            trafficMsgColor = "#ff0000";
        }
    }
    
    updateHUD();
    localStorage.setItem('f1_coins', coins);
    
    setTimeout(() => {
        triviaModal.classList.add('hidden');
        if(safetyRating > 0) {
            gameState = 'playing';
            entities = [];
            if(isLightEvent) {
                setTimeout(() => {
                    trafficLightState = 'none';
                    trafficMsg = "";
                    speed = baseSpeed;
                }, acertou ? 1000 : 4000);
            }
        }
    }, 2000);
}

function startTrafficLightSequence() {
    trafficLightState = 'yellow';
    trafficMsg = "POR FAVOR PARAR";
    trafficMsgColor = "#ffff00";
    distanceCounter = 0;
    nextLightThreshold = 3000 + Math.random() * 2000;
    
    initTrivia(true); 
}

// ======= SISTEMA DE GARAGEM ======= //
function openGarage() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    const garageScreen = document.getElementById('garage-screen');
    garageScreen.classList.remove('hidden');
    renderGarage();
}

function closeGarage() {
    document.getElementById('garage-screen').classList.add('hidden');
    startScreen.classList.remove('hidden');
}

function renderGarage() {
    const list = document.getElementById('car-list');
    list.innerHTML = '';
    document.getElementById('garage-coins').innerText = coins;
    
    carModels.forEach((car, index) => {
        const card = document.createElement('div');
        card.className = `car-card ${currentCarIndex === index ? 'active' : ''}`;
        
        const isOwned = ownedCars.includes(index);
        
        card.innerHTML = `
            <div class="car-preview" style="background-color: ${car.color}"></div>
            <h3>${car.name}</h3>
            <p>Velocidade: x${car.speedMult}</p>
            ${isOwned ? 
                `<button class="btn ${currentCarIndex === index ? '' : 'primary-btn'}" onclick="selectCar(${index})">${currentCarIndex === index ? 'SELECIONADO' : 'SELECIONAR'}</button>` :
                `<button class="btn primary-btn" onclick="buyCar(${index})">COMPRAR ($${car.price})</button>`
            }
        `;
        list.appendChild(card);
    });
}

function selectCar(index) {
    currentCarIndex = index;
    localStorage.setItem('f1_current_car', index);
    renderGarage();
}

function buyCar(index) {
    const car = carModels[index];
    if (coins >= car.price) {
        coins -= car.price;
        ownedCars.push(index);
        localStorage.setItem('f1_coins', coins);
        localStorage.setItem('f1_owned_cars', JSON.stringify(ownedCars));
        selectCar(index);
    } else {
        alert("Moedas insuficientes!");
    }
}

// Expo para o HTML
window.openGarage = openGarage;
window.closeGarage = closeGarage;
window.selectCar = selectCar;
window.buyCar = buyCar;

