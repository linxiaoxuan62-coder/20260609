let video, prediction = "", hands = [];
let lastGesture = ""; // 紀錄上一次的手勢，避免重複觸發
let gameState = 'START'; // START, PLAYING, END
let handPose; // ml5 handPose model
let score = 0;
let health = 100;
let startButton;
let enemy = { x: 0, y: 0, speed: 1, size: 50, frozen: false, health: 100, maxHealth: 100 };
let isShielded = false;
let gameTimer = 60; // 遊戲時長 (秒)
let startTime;
let fireEffectTimer = 0; // 控制火焰效果顯示時間

function setup() {
  // 建立全螢幕畫布
  createCanvas(windowWidth, windowHeight);

  // 建立 webcam 影像擷取
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // 載入 ml5 handPose 模型
  handPose = ml5.handPose(video, modelReady);

  // 建立開始按鈕
  startButton = createButton('進入魔法領域');
  startButton.position(width / 2 - 60, height / 2 + 100);
  startButton.mousePressed(startGame);
  styleButton(startButton);

  resetEnemy();
}

// 當模型載入完成時呼叫
function modelReady() {
  console.log('HandPose model loaded!');
  // 使用 detectStart 確保持續偵測並回傳手部陣列
  handPose.detectStart(video, gotHands);
}

function gotHands(results) {
  hands = results;

  if (hands.length > 0) {
    let hand = hands[0];
    let thumbTip = hand.keypoints[4];
    let indexTip = hand.keypoints[8];
    let wrist = hand.keypoints[0];

    let currentGesture = "";
    // 計算關鍵點之間的距離
    let indexDist = dist(indexTip.x, indexTip.y, wrist.x, wrist.y);
    let thumbIndexDist = dist(thumbTip.x, thumbTip.y, indexTip.x, indexTip.y);

    // 1. 👌 OK (Freeze) - 大拇指與食指尖端靠近
    if (thumbIndexDist < 40) {
      currentGesture = "freeze";
    } 
    // 2. 👍 Fire (讚) - 大拇指尖端高於關節，且食指收起 (靠近手腕)
    else if (thumbTip.y < hand.keypoints[2].y && indexDist < 100) {
      currentGesture = "fire";
    }
    // 3. ✋ Shield (掌) - 食指伸直 (遠離手腕)
    else if (indexDist > 150) {
      currentGesture = "shield";
    }

    // 只有在手勢「改變」時才觸發一次魔法，避免分數暴增
    if (currentGesture !== "" && currentGesture !== lastGesture) {
      prediction = currentGesture;
    }
    lastGesture = currentGesture;
  } else {
    lastGesture = "";
  }
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

  // 繪製手部關鍵點骨架
  drawHandKeypoints();

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

  // 繪製魔法效果回饋 (🔥, 🛡, ❄)
  drawSpellFeedback();

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
              "👍 FIRE (讚): 火球攻擊 (敵人血量 -20) +1分\n" +
              "✋ SHIELD (掌): 兩秒內不扣血\n" +
              "👌 FREEZE (OK): 冰凍敵人 3 秒 (+2分)";
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
    enemy.health -= 20; // 扣除敵人血量
    fireEffectTimer = 20; // 啟動 20 幀的畫面特效
    
    // 如果敵人沒血了，重置敵人並額外獎勵
    if (enemy.health <= 0) {
      score += 10;
      resetEnemy();
    }
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

// 根據目前的魔法狀態繪製全畫面特效
function drawSpellFeedback() {
  push();
  noStroke();
  textAlign(CENTER, CENTER);
  
  // 1. 火球效果 (👍) - 紅色濾鏡與 🔥
  if (fireEffectTimer > 0) {
    fill(255, 50, 0, map(fireEffectTimer, 0, 20, 0, 100));
    rect(0, 0, width, height);
    textSize(120);
    text("🔥", width / 2, height / 2);
    fireEffectTimer--;
  }

  // 2. 護盾狀態 (✋) - 藍色濾鏡與 🛡️
  if (isShielded) {
    fill(0, 150, 255, 40);
    rect(0, 0, width, height);
    textSize(120);
    fill(255, 200);
    text("🛡️", width / 2, height / 2);
  }

  // 3. 冰凍狀態 (👌) - 冰藍色濾鏡與 ❄️
  if (lastGesture === "freeze") {
    fill(100, 220, 255, 80);
    rect(0, 0, width, height);
    textSize(120);
    fill(255, 200);
    text("❄️", width / 2, height / 2);
  }
  pop();
}

function updateEnemy() {
  if (!enemy.frozen) {
    enemy.x += enemy.speed;
    // 敵人到達右側後重置
    if (enemy.x > width + 50) resetEnemy();
  }

  // 碰撞檢測：如果敵人靠近視訊畫面中心
  let d = dist(enemy.x, enemy.y, width / 2, height / 2);
  let isAngry = d < 150;
  if (isAngry && !isShielded) health -= 0.5;
  
  // 繪製怪物圖案 (取代原本的紫色圓形)
  drawMonster(enemy.x, enemy.y, enemy.size, enemy.frozen, isAngry);
  
  // 繪製敵人血條
  fill(50);
  rect(enemy.x - 25, enemy.y - 40, 50, 8);
  fill(255, 0, 0);
  let healthWidth = map(enemy.health, 0, enemy.maxHealth, 0, 50);
  rect(enemy.x - 25, enemy.y - 40, healthWidth, 8);
}

function resetEnemy() {
  enemy.x = -50;
  enemy.health = 100;
  enemy.y = random(height * 0.2, height * 0.8);
  enemy.speed = random(1, 3);
}

// 繪製怪物圖案邏輯 (包含身體、角、眼睛、嘴巴)
function drawMonster(x, y, s, frozen, angry) {
  push();
  translate(x, y);
  
  // 怪物身體顏色
  if (angry) fill(255, 60, 60); // 靠近玩家時變紅 (生氣)
  else if (frozen) fill(160, 230, 255); // 冰凍時變淺藍色
  else fill(180, 120, 255); // 平時為紫色
  
  noStroke();
  // 身體主體
  ellipse(0, 0, s, s * 0.85);
  
  // 怪物角 (深色)
  fill(40);
  triangle(-s * 0.3, -s * 0.3, -s * 0.5, -s * 0.8, -s * 0.1, -s * 0.4);
  triangle(s * 0.3, -s * 0.3, s * 0.5, -s * 0.8, s * 0.1, -s * 0.4);
  
  // 眼睛
  fill(255);
  ellipse(-s * 0.2, -s * 0.1, s * 0.3);
  ellipse(s * 0.2, -s * 0.1, s * 0.3);
  
  // 瞳孔
  fill(0);
  let pSize = angry ? s * 0.05 : s * 0.15; // 憤怒時瞳孔收縮，看起來更兇
  ellipse(-s * 0.2, -s * 0.1, pSize);
  ellipse(s * 0.2, -s * 0.1, pSize);
  
  // 嘴巴
  angry ? fill(255) : noFill();
  stroke(angry ? 255 : 0);
  strokeWeight(2);
  if (angry) triangle(-s * 0.15, s * 0.1, 0, s * 0.3, s * 0.15, s * 0.1); // 尖牙
  else arc(0, s * 0.1, s * 0.3, s * 0.2, 0, PI); // 微笑
  
  pop();
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

// 繪製手部關鍵點連線邏輯
function drawHandKeypoints() {
  strokeWeight(5); // 稍微加粗一點讓線條更明顯
  
  for (let hand of hands) {
    if (hand.keypoints) {
      // 使用 toLowerCase() 來忽略大小寫差異
      let label = hand.label ? hand.label.toLowerCase() : "";
      
      if (label === 'left') {
        stroke(255, 0, 0); // 左手顯示為紅色
      } else if (label === 'right') {
        stroke(0, 0, 255); // 右手顯示為藍色
      } else {
        // 如果沒有明確的左右手標籤，則使用預設顏色 (例如，當前手勢的顏色)
        if (lastGesture === "fire") stroke(255, 100, 0); // 橘紅色
        else if (lastGesture === "freeze") stroke(0, 200, 255); // 天藍色
        else if (lastGesture === "shield") stroke(255, 255, 0); // 黃色
        else stroke(0, 255, 0); // 預設綠色
      }

      // 定義需要串接的關鍵點群組
      let fingerSegments = [
        [0, 1, 2, 3, 4],    // 大拇指
        [5, 6, 7, 8],       // 食指
        [9, 10, 11, 12],    // 中指
        [13, 14, 15, 16],   // 無名指
        [17, 18, 19, 20]    // 小指
      ];

      for (let segment of fingerSegments) {
        for (let i = 0; i < segment.length - 1; i++) {
          let p1 = hand.keypoints[segment[i]];
          let p2 = hand.keypoints[segment[i+1]];
          if (p1 && p2) {
            // 由於影片是 640x480 且 imageMode 為 CENTER，座標需減去中心點偏移量 (320, 240)
            line(p1.x - 320, p1.y - 240, p2.x - 320, p2.y - 240);
          }
        }
      }
    }
  }
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
