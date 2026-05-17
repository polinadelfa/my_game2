(function(){
    // ========== ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ ==========
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // ========== ИГРОВЫЕ КОНСТАНТЫ ==========
    const LANE_COUNT = 3;
    const LANE_WIDTH = canvas.width / LANE_COUNT;
    let playerLane = 1;
    const CAR_WIDTH = 48;
    const CAR_HEIGHT = 52;
    
    // ========== ПЕРЕМЕННЫЕ ИГРЫ ==========
    let obstacles = [];
    let frameCounter = 0;
    let spawnGap = 45;
    let baseSpeed = 3.2;
    let currentSpeed = baseSpeed;
    let score = 0;
    let gameOver = false;
    let animationId = null;
    
    // ========== РЕКОРДЫ ==========
    // Рекорд из PHP сессии (переданный с сервера)
    let serverHighScore = parseInt(document.getElementById('highScore').innerText) || 0;
    // Рекорд из localStorage (сохраняется в браузере навсегда)
    let localHighScore = 0;
    
    // Загружаем рекорд из localStorage при запуске
    function loadLocalHighScore() {
        const saved = localStorage.getItem('carGameHighScore');
        if (saved !== null) {
            localHighScore = parseInt(saved);
            document.getElementById('localHighScore').innerText = localHighScore;
        } else {
            localHighScore = 0;
            document.getElementById('localHighScore').innerText = '0';
        }
    }
    
    // Сохраняем рекорд в localStorage
    function saveLocalHighScore(score) {
        if (score > localHighScore) {
            localHighScore = score;
            localStorage.setItem('carGameHighScore', score);
            document.getElementById('localHighScore').innerText = score;
            return true; // Рекорд обновлён
        }
        return false;
    }
    
    // Получаем максимальный рекорд (из двух источников)
    function getMaxHighScore() {
        return Math.max(serverHighScore, localHighScore);
    }
    
    // ========== ЗАГРУЖЕННОЕ ИЗОБРАЖЕНИЕ ==========
    let customCarImage = null;
    let useCustomImage = false;
    
    // ========== DOM ЭЛЕМЕНТЫ ==========
    const currentScoreSpan = document.getElementById('currentScore');
    const highScoreSpan = document.getElementById('highScore');      // Серверный рекорд
    const localHighScoreSpan = document.getElementById('localHighScore');
    const gameStatusDiv = document.getElementById('gameStatus');
    const carNameSpan = document.getElementById('carName');
    
    // ========== ОТПРАВКА РЕКОРДА НА СЕРВЕР (PHP) ==========
    function updateHighScoreOnServer(newScore) {
        if (newScore <= serverHighScore) return Promise.resolve(false);
        
        return fetch('index.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `score=${newScore}`
        })
        .then(res => res.json())
        .then(data => {
            if (data.new_high) {
                serverHighScore = data.high_score;
                highScoreSpan.innerText = serverHighScore;
                gameStatusDiv.innerText = '🔥 НОВЫЙ РЕКОРД СЕССИИ! 🔥';
                setTimeout(() => {
                    if(!gameOver) gameStatusDiv.innerText = '⬅️ ➡️ управление / обходи блоки';
                }, 1500);
                return true;
            } else {
                serverHighScore = data.high_score;
                highScoreSpan.innerText = serverHighScore;
                return false;
            }
        })
        .catch(err => {
            console.warn("Ошибка отправки рекорда на сервер", err);
            return false;
        });
    }
    
    // ========== ОБНОВЛЕНИЕ СЧЁТА (с синхронизацией рекордов) ==========
    async function setScore(newScore) {
        score = newScore;
        currentScoreSpan.innerText = score;
        
        let maxScore = getMaxHighScore();
        let anyRecordUpdated = false;
        
        // Проверяем и обновляем локальный рекорд (localStorage)
        if (score > localHighScore) {
            saveLocalHighScore(score);
            anyRecordUpdated = true;
            gameStatusDiv.innerText = '💾 НОВЫЙ ЛОКАЛЬНЫЙ РЕКОРД! Сохранён в браузере!';
            setTimeout(() => {
                if(!gameOver && gameStatusDiv.innerText.includes('ЛОКАЛЬНЫЙ')) 
                    gameStatusDiv.innerText = '⬅️ ➡️ управление / обходи блоки';
            }, 2000);
        }
        
        // Проверяем и обновляем серверный рекорд
        if (score > serverHighScore) {
            await updateHighScoreOnServer(score);
            anyRecordUpdated = true;
        }
        
        // Если оба рекорда обновлены, показываем специальное сообщение
        if (anyRecordUpdated && score > maxScore) {
            gameStatusDiv.innerText = '🏆 ВСЕ РЕКОРДЫ ОБНОВЛЕНЫ! 🏆';
            setTimeout(() => {
                if(!gameOver) gameStatusDiv.innerText = '⬅️ ➡️ управление / обходи блоки';
            }, 2000);
        }
    }
    
    // ========== СБРОС ЛОКАЛЬНОГО РЕКОРДА ==========
    function resetLocalHighScore() {
        if (confirm('Вы уверены, что хотите сбросить локальный рекорд браузера?')) {
            localStorage.removeItem('carGameHighScore');
            localHighScore = 0;
            document.getElementById('localHighScore').innerText = '0';
            gameStatusDiv.innerText = '🗑️ Локальный рекорд сброшен!';
            setTimeout(() => {
                if(!gameOver) gameStatusDiv.innerText = '⬅️ ➡️ управление / обходи блоки';
            }, 1500);
        }
    }
    
    // ========== ПЕРЕЗАПУСК ИГРЫ ==========
    function restartGame() {
        gameOver = false;
        playerLane = 1;
        obstacles = [];
        frameCounter = 0;
        currentSpeed = baseSpeed;
        setScore(0);  // Обратите внимание: setScore теперь асинхронный
        gameStatusDiv.innerText = '⬅️ ➡️ игра началась!';
        setTimeout(() => {
            if(!gameOver) gameStatusDiv.innerText = '⬅️ ➡️ управление / обходи блоки';
        }, 1200);
    }
    
    // ========== СОЗДАНИЕ ПРЕПЯТСТВИЯ ==========
    function addObstacle() {
        const laneIndex = Math.floor(Math.random() * LANE_COUNT);
        const obsW = 44;
        const obsH = 48;
        const x = laneIndex * LANE_WIDTH + (LANE_WIDTH/2) - obsW/2;
        obstacles.push({
            x: x,
            y: -obsH,
            width: obsW,
            height: obsH,
            lane: laneIndex
        });
    }
    
    // ========== ОБНОВЛЕНИЕ ЛОГИКИ ИГРЫ ==========
    function updateGame() {
        if (gameOver) return;
        
        // Движение препятствий вниз
        for (let i = 0; i < obstacles.length; i++) {
            obstacles[i].y += currentSpeed;
        }
        
        // Удаление ушедших за экран и начисление очков
        obstacles = obstacles.filter(obs => {
            if (obs.y > canvas.height) {
                setScore(score + 10);
                return false;
            }
            return true;
        });
        
        // Спавн новых препятствий
        if (frameCounter >= spawnGap) {
            frameCounter = 0;
            addObstacle();
            let newGap = Math.max(25, 45 - Math.floor(score / 380));
            spawnGap = newGap;
            currentSpeed = Math.min(7.5, baseSpeed + Math.floor(score / 700));
        } else {
            frameCounter++;
        }
        
        // Проверка столкновения
        const playerCarX = playerLane * LANE_WIDTH + (LANE_WIDTH/2) - CAR_WIDTH/2;
        const playerCarY = canvas.height - CAR_HEIGHT - 10;
        const carRect = {
            x: playerCarX,
            y: playerCarY,
            w: CAR_WIDTH,
            h: CAR_HEIGHT
        };
        
        for (let obs of obstacles) {
            const obsRect = {
                x: obs.x,
                y: obs.y,
                w: obs.width,
                h: obs.height
            };
            if (carRect.x < obsRect.x + obsRect.w &&
                carRect.x + carRect.w > obsRect.x &&
                carRect.y < obsRect.y + obsRect.h &&
                carRect.y + carRect.h > obsRect.y) {
                gameOver = true;
                gameStatusDiv.innerText = '💥 АВАРИЯ! Нажмите РЕСТАРТ 💥';
                break;
            }
        }
    }
    
    // ========== ОТРИСОВКА ДОРОГИ ==========
    function drawRoad() {
        ctx.fillStyle = '#2c2e3a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#FFD966';
        ctx.lineWidth = 4;
        for (let i = 1; i < LANE_COUNT; i++) {
            ctx.beginPath();
            ctx.setLineDash([20, 30]);
            ctx.moveTo(i * LANE_WIDTH, 0);
            ctx.lineTo(i * LANE_WIDTH, canvas.height);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        
        ctx.strokeStyle = '#b87c4f';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, canvas.width-16, canvas.height-16);
        
        ctx.fillStyle = '#e0b074';
        for(let i = 0; i < 10; i++) {
            ctx.fillRect(10, i * 45 + 15, 12, 25);
            ctx.fillRect(canvas.width-22, i * 45 + 15, 12, 25);
        }
    }
    
    // ========== ОТРИСОВКА МАШИНКИ ==========
    function drawPlayer() {
        const x = playerLane * LANE_WIDTH + (LANE_WIDTH/2) - CAR_WIDTH/2;
        const y = canvas.height - CAR_HEIGHT - 10;
        
        if (useCustomImage && customCarImage) {
            ctx.drawImage(customCarImage, x, y, CAR_WIDTH, CAR_HEIGHT);
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = '#e34234';
            ctx.beginPath();
            ctx.roundRect(x, y, CAR_WIDTH, CAR_HEIGHT, 10);
            ctx.fill();
            ctx.fillStyle = '#b22222';
            ctx.beginPath();
            ctx.roundRect(x+4, y-4, CAR_WIDTH-8, 10, 4);
            ctx.fill();
            ctx.fillStyle = '#7ec8e0';
            ctx.fillRect(x+6, y+8, 12, 20);
            ctx.fillRect(x+CAR_WIDTH-18, y+8, 12, 20);
            ctx.fillStyle = '#FFD966';
            ctx.fillRect(x+2, y+CAR_HEIGHT-10, 8, 6);
            ctx.fillRect(x+CAR_WIDTH-10, y+CAR_HEIGHT-10, 8, 6);
            ctx.fillStyle = '#fff9c4';
            ctx.fillRect(x+2, y+2, 8, 6);
            ctx.fillRect(x+CAR_WIDTH-10, y+2, 8, 6);
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(x+5, y+CAR_HEIGHT-8, 8, 8);
            ctx.fillRect(x+CAR_WIDTH-13, y+CAR_HEIGHT-8, 8, 8);
        }
    }
    
    // ========== ОТРИСОВКА ПРЕПЯТСТВИЯ ==========
    function drawObstacle(obs) {
        ctx.fillStyle = '#6f4f37';
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 8);
        ctx.fill();
        ctx.fillStyle = '#aa7c58';
        ctx.fillRect(obs.x+5, obs.y+5, obs.width-10, 8);
        ctx.fillStyle = '#d9a066';
        ctx.fillRect(obs.x+8, obs.y+obs.height-12, obs.width-16, 6);
        ctx.fillStyle = '#cc5500';
        ctx.font = "bold 22px monospace";
        ctx.fillText("⚠", obs.x+14, obs.y+34);
    }
    
    // ========== ЭКРАН GAME OVER ==========
    function drawGameOverlay() {
        if (gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffbc6e';
            ctx.font = 'bold 26 "Segoe UI", system-ui';
            ctx.fillText('GAME OVER', canvas.width/2-100, canvas.height/2-20);
            ctx.font = '16px monospace';
            ctx.fillStyle = '#eedd99';
            ctx.fillText('нажмите "РЕСТАРТ"', canvas.width/2-95, canvas.height/2+35);
        }
    }
    
    // ========== ОТРИСОВКА ВСЕГО ==========
    function render() {
        drawRoad();
        for (let obs of obstacles) drawObstacle(obs);
        drawPlayer();
        drawGameOverlay();
    }
    
    // ========== ИГРОВОЙ ЦИКЛ ==========
    function gameLoop() {
        if (!gameOver) {
            updateGame();
        }
        render();
        animationId = requestAnimationFrame(gameLoop);
    }
    
    // ========== УПРАВЛЕНИЕ ==========
    function moveLeft() {
        if (gameOver) return;
        if (playerLane > 0) playerLane--;
    }
    
    function moveRight() {
        if (gameOver) return;
        if (playerLane < LANE_COUNT-1) playerLane++;
    }
    
    // ========== ЗАГРУЗКА ИЗОБРАЖЕНИЯ ==========
    function loadCarImage(file) {
        if (!file) return;
        
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            gameStatusDiv.innerText = '❌ Ошибка: поддерживаются PNG, JPEG, GIF, WEBP';
            setTimeout(() => {
                if(!gameOver) gameStatusDiv.innerText = '⬅️ ➡️ управление / обходи блоки';
            }, 2000);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                customCarImage = img;
                useCustomImage = true;
                const fileName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
                carNameSpan.innerHTML = `🚗 ${fileName}`;
                gameStatusDiv.innerText = '✅ Машинка загружена! Удачи на дороге!';
                setTimeout(() => {
                    if(!gameOver) gameStatusDiv.innerText = '⬅️ ➡️ управление / обходи блоки';
                }, 2000);
            };
            img.onerror = function() {
                gameStatusDiv.innerText = '❌ Не удалось загрузить изображение';
                useCustomImage = false;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    // ========== СБРОС К СТАНДАРТНОЙ МАШИНКЕ ==========
    function resetToDefaultCar() {
        useCustomImage = false;
        customCarImage = null;
        carNameSpan.innerHTML = '🚗 стандартная';
        gameStatusDiv.innerText = '🔄 Стандартная машинка восстановлена';
        setTimeout(() => {
            if(!gameOver) gameStatusDiv.innerText = '⬅️ ➡️ управление / обходи блоки';
        }, 1500);
    }
    
    // ========== ОБРАБОТЧИКИ КЛАВИШ ==========
    function handleKeydown(e) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            moveLeft();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            moveRight();
        }
    }
    
    // ========== ИНИЦИАЛИЗАЦИЯ УПРАВЛЕНИЯ ==========
    function initControls() {
        window.addEventListener('keydown', handleKeydown);
        document.getElementById('leftBtn').addEventListener('click', () => moveLeft());
        document.getElementById('rightBtn').addEventListener('click', () => moveRight());
        document.getElementById('restartButton').addEventListener('click', () => restartGame());
        document.getElementById('resetLocalStorageBtn').addEventListener('click', () => resetLocalHighScore());
        
        const carInput = document.getElementById('carImageInput');
        carInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                loadCarImage(e.target.files[0]);
            }
            carInput.value = '';
        });
        
        document.getElementById('resetCarBtn').addEventListener('click', () => resetToDefaultCar());
        
        const btns = document.querySelectorAll('.control-btn, .restart-btn, .reset-car-btn, .upload-label, #resetLocalStorageBtn');
        btns.forEach(btn => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if(btn.id === 'leftBtn') moveLeft();
                if(btn.id === 'rightBtn') moveRight();
                if(btn.id === 'restartButton') restartGame();
                if(btn.id === 'resetCarBtn') resetToDefaultCar();
                if(btn.id === 'resetLocalStorageBtn') resetLocalHighScore();
            });
        });
    }
    
    // ========== ПОЛИФИЛ ДЛЯ roundRect ==========
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
            if (w < 2 * r) r = w / 2;
            if (h < 2 * r) r = h / 2;
            this.moveTo(x+r, y);
            this.lineTo(x+w-r, y);
            this.quadraticCurveTo(x+w, y, x+w, y+r);
            this.lineTo(x+w, y+h-r);
            this.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
            this.lineTo(x+r, y+h);
            this.quadraticCurveTo(x, y+h, x, y+h-r);
            this.lineTo(x, y+r);
            this.quadraticCurveTo(x, y, x+r, y);
            return this;
        };
    }
    
    // ========== ЗАПУСК ИГРЫ ==========
    async function startGame() {
        loadLocalHighScore();      // Загружаем рекорд из localStorage
        restartGame();             // Инициализируем игру
        initControls();            // Подключаем управление
        gameLoop();                // Запускаем игровой цикл
    }
    
    startGame();
})();