<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="content-type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
  <title>Mine'er'ish</title>
  <link rel="stylesheet" media="screen" href="css/font.css?<?=filemtime("css/font.css")?>">
  <link rel="stylesheet" media="screen" href="css/main.css?<?=filemtime("css/main.css")?>">
  <style id="shake"></style>
</head>

<body>
  <div class="content">
    <div class="control">
      <span>
        <span>
          <span>Size:</span>
          <span>
            <select id="width"></select> x <select id="height"></select>
            <!-- <input id="width" type="number" value="10"/> x <input id="height" type="number" value="10"/> -->
          </span>
        </span>
        <span>
          <span>Mines:</span>
          <span>
            <input id="mines" type="number" value="20"/>
          </span>
        </span>
      </span>
      <span>
        <span><button id="pause">Pause</button></span>
        <span><button id="reset">New game</button></span>
      </span>
      <span>
        <label title="Primary action"><input id="click" type="checkbox"><span>Open</span></label>
      </span>
      <span>
        <span id="difficulty"></span>
      </span>
    </div>
    <div class="stats">
      <div>
        <span>
          <span>Time:</span><span id="clock"><span>00</span><span>00</span><span>00</span><span>000</span></span>
        </span>
        <span>
          <span>Mines:</span><span><span id="minesFound">0</span>/<span id="minesTotal">0</span>(<span id="minesPercent">0</span>%)</span>
        </span>
        <span>
          <span>Steps:</span><span id="steps">0</span></span>
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