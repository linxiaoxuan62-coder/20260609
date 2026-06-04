let video, prediction;
let gameState = 'START'; // START, PLAYING, END
let score = 0;
let health = 100;
let startButton;
let enemy = { x: 0, y: 0, speed: 2, size: 40, frozen: false };
let isShielded = false;
let gameTimer = 30; // 遊戲時長 (秒)
let startTime;

function setup() {
  // 建立全螢幕畫布
  createCanvas(windowWidth, windowHeight);

  // 建立 webcam 影像擷取
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // 建立開始按鈕
  startButton = createButton('進入魔法領域');
  startButton.position(width / 2 - 60, height / 2 + 100);
  startButton.mousePressed(startGame);
  styleButton(startButton);

  resetEnemy();
}

function draw() {
  // 繪製魔法風格背景
  drawMagicBackground();

  if (gameState === 'START') {
    drawStartScreen();
  } else if (gameState === 'PLAYING') {
    drawGameContent();
  } else if (gameState === 'END') {
    drawEndScreen();
  }
}

function drawGameContent() {
  // 計算居中位置
  let x = (width - video.width) / 2;
  let y = (height - video.height) / 2;

  // 繪製影像背景裝飾框 (魔法陣質感)
  push();
  noFill();
  stroke(180, 150, 255, 150); // 淡紫色
  strokeWeight(8);
  rect(x - 10, y - 10, video.width + 20, video.height + 20, 10);
  pop();

  // 顯示影像 (加上水平翻轉，讓鏡頭像鏡子一樣自然)
  push();
  translate(width / 2, height / 2);
  scale(-1, 1); // 水平鏡像
  imageMode(CENTER);
  image(video, 0, 0);

  // 繪製護盾效果
  if (isShielded) {
    noFill();
    stroke(0, 255, 255, 150);
    strokeWeight(10);
    ellipse(0, 0, video.width + 40);
  }
  pop();

  // 處理魔法觸發
  handleSpells();

  // 更新敵人狀態
  updateEnemy();

  // 繪製計分板
  drawUI();
}

function drawStartScreen() {
  textAlign(CENTER, CENTER);
  noStroke();
  fill(200, 150, 255);
  textSize(64);
  text("魔法手勢對戰遊戲", width / 2, height / 2 - 120);

  fill(255);
  textSize(20);
  let rules = "【 魔法規則說明 】\n\n" +
              "🔥 FIRE (火): 增加積分 +1\n" +
              "🛡️ SHIELD (護盾): 兩秒內不扣血\n" +
              "❄️ FREEZE (冰凍): 敵人停止移動三秒";
  text(rules, width / 2, height / 2 + 10);
}

function drawEndScreen() {
  textAlign(CENTER, CENTER);
  noStroke();
  
  // 判斷勝負標題
  if (health <= 0) {
    fill(255, 50, 50);
    textSize(80);
    text("冒險失敗", width / 2, height / 2 - 60);
  } else {
    fill(255, 215, 0); // 金色
    textSize(80);
    text("領域守護成功！", width / 2, height / 2 - 60);
  }

  fill(255);
  textSize(32);
  text(`最終能量積分: ${score}`, width / 2, height / 2 + 20);
  textSize(20);
  text("點擊下方按鈕重新開始", width / 2, height / 2 + 60);
}

function drawUI() {
  fill(255);
  textSize(28);
  textAlign(LEFT);

  // 計算剩餘時間
  let elapsed = floor((millis() - startTime) / 1000);
  let timeLeft = max(0, gameTimer - elapsed);

  text(`能量積分: ${score}`, 40, 50);
  text(`生命值: ${floor(health)}%`, 40, 90);
  text(`剩餘時間: ${timeLeft} 秒`, 40, 130);

  // 檢查結束條件：生命值歸零 或 時間結束
  if (health <= 0 || timeLeft <= 0) {
    gameState = 'END';
    startButton.html('再次挑戰');
    startButton.show();
  }
}

function handleSpells() {
  // 這裡接收 AI 辨識的結果
  if (prediction === "fire") {
    score += 1;
    fill(255, 50, 0, 100);
    rect(0, 0, width, height); // 觸發紅光閃爍
    prediction = ""; // 觸發後重置
  } else if (prediction === "shield") {
    isShielded = true;
    setTimeout(() => isShielded = false, 2000); 
    prediction = "";
  } else if (prediction === "freeze") {
    enemy.frozen = true;
    score += 2; // 增加冰凍魔法的分數
    setTimeout(() => enemy.frozen = false, 3000);
    prediction = "";
  }
}

function updateEnemy() {
  if (!enemy.frozen) {
    enemy.x += enemy.speed;
    // 敵人到達右側後重置
    if (enemy.x > width + 50) resetEnemy();
  }

  // 碰撞檢測：如果敵人靠近視訊畫面中心
  let d = dist(enemy.x, enemy.y, width / 2, height / 2);
  if (d < 150) {
    if (!isShielded) health -= 0.5; // 每幀扣血
    fill(255, 0, 0); // 警示色
  } else {
    enemy.frozen ? fill(100, 200, 255) : fill(200, 100, 255);
  }
  
  noStroke();
  ellipse(enemy.x, enemy.y, enemy.size);
}

function resetEnemy() {
  enemy.x = -50;
  enemy.y = random(height * 0.2, height * 0.8);
  enemy.speed = random(3, 7);
}

function startGame() {
  gameState = 'PLAYING';
  startButton.hide();
  startTime = millis(); // 記錄開始的時間點
  score = 0;
  health = 100;
  resetEnemy();
}

function styleButton(btn) {
  btn.style('background-color', '#4a148c');
  btn.style('color', '#ffffff');
  btn.style('padding', '12px 24px');
  btn.style('border', '2px solid #ba68c8');
  btn.style('border-radius', '30px');
  btn.style('font-size', '18px');
  btn.style('cursor', 'pointer');
  btn.style('box-shadow', '0 0 15px rgba(186, 104, 200, 0.5)');
}

// 魔法背景繪製邏輯
function drawMagicBackground() {
  background(15, 10, 40); // 深邃的暗紫色
  
  // 繪製魔法陣中心特效
  push();
  translate(width / 2, height / 2);
  noFill();
  stroke(100, 80, 255, 100); // 柔和的紫色
  
  // 繪製多層旋轉圓圈
  let rot = frameCount * 0.01;
  strokeWeight(2);
  ellipse(0, 0, 700 + sin(frameCount * 0.02) * 10);
  ellipse(0, 0, 750);
  
  // 旋轉的星形線條
  rotate(rot);
  for (let i = 0; i < 8; i++) {
    rotate(PI / 4);
    line(-400, 0, 400, 0);
    ellipse(350, 0, 20, 20);
  }
  pop();

  // 產生隨機的微弱星光與魔法粒子
  for (let i = 0; i < 20; i++) {
    let flareX = noise(i, frameCount * 0.005) * width;
    let flareY = noise(i + 10, frameCount * 0.005) * height;
    let flareSize = noise(i + 20, frameCount * 0.01) * 15;
    noStroke();
    fill(140, 100, 255, 100);
    ellipse(flareX, flareY, flareSize);
  }
}

// 當視窗大小改變時，自動調整畫布
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
