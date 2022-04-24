<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="content-type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
  <title>Mine'er'ish</title>
  <link rel="stylesheet" media="screen" href="css/font.css?<?=filemtime("css/font.css")?>">
  <link rel="stylesheet" media="screen" href="css/main.css?<?=filemtime("css/main.css")?>">
</head>

<body>
  <div class="content">
    <div class="control">
      <span>
        <span>
          <span>Size:</span>
          <span>
            <input id="width" type="number" /> x <input id="height" type="number" />
          </span>
        </span>
        <span>
          <span>Mines:</span>
          <span>
            <input id="mines" type="number" />
          </span>
        </span>
      </span>
      <span>
        <span><button id="reset">New game</button></span>
      </span>
      <span>
        <span id="difficulty"></span>
      </span>
    </div>
    <div class="stats">
      <div>
        <span>
          <span>Time:</span><span id="clock"><span></span><span></span><span></span></span>
        </span>
        <span>
          <span>Mines:</span><span><span id="minesFound"></span>/<span id="minesTotal"></span>(<span id="minesPercent"></span>%)</span>
        </span>
        <span>
          <span>Steps:</span><span id="steps"></span></span>
        </span>
      </div>
    </div>
  <div class="tableBox">
    <div id="table"></div>
  </div>
  <div class="hidden"></div>
  <script type="text/javascript" src="main.js?<?=filemtime("main.js")?>"></script>
</body>

</html>