<?php
session_start();
if (!isset($_SESSION['high_score'])) {
    $_SESSION['high_score'] = 0;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['score'])) {
    $score = (int)$_POST['score'];
    if ($score > $_SESSION['high_score']) {
        $_SESSION['high_score'] = $score;
        echo json_encode(['new_high' => true, 'high_score' => $_SESSION['high_score']]);
    } else {
        echo json_encode(['new_high' => false, 'high_score' => $_SESSION['high_score']]);
    }
    exit;
}

$high_score = $_SESSION['high_score'];
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Машинка: обход препятствий</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
<div>
    <div class="game-container">
        <canvas id="gameCanvas" width="600" height="400"></canvas>

        <div class="info-panel">
            <div class="score-box">🏆 СЧЁТ: <span id="currentScore">0</span></div>
            <div class="score-box">⭐ РЕКОРД: <span id="highScore"><?= $high_score ?></span></div>
            <button class="restart-btn" id="restartButton">🚗 РЕСТАРТ</button>
        </div>

        <div class="upload-section">
            <label class="upload-label" id="uploadLabel">
                📁 ЗАГРУЗИТЬ МАШИНКУ
                <input type="file" id="carImageInput" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp">
            </label>
            <button class="reset-car-btn" id="resetCarBtn">🔄 СТАНДАРТНАЯ</button>
            <span style="color:#ffd966; font-size:12px;" id="carName">🚗 стандартная</span>
        </div>

        <div class="controls">
            <div class="control-btn" id="leftBtn">◀ ЛЕВО</div>
            <div class="control-btn" id="rightBtn">ПРАВО ▶</div>
        </div>
        <div class="status" id="gameStatus">⬅️ ➡️ управление / загрузи свою машинку!</div>
    </div>
</div>

<script src="js/game.js"></script>
</body>
</html>