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
  <nav class="control">
    <span>
      <span><button id="pause">Pause</button></span>
      <span><button id="reset">New game</button></span>
    </span>
    <span>
      <span id="difficulty"></span>
    </span>
  </nav>
  <main>
    <div class="stats">
      <div>
        <span>
          <span>Time:</span><span id="clock"><span data-time="d"></span><span data-time="h">00</span><span data-time="m">00</span><span data-time="s">00</span><span data-time="ms">000</span></span>
        </span>
        <span>
          <span>Mines:</span><span><span id="minesFound">0</span>/<span id="minesTotal">0</span>(<span id="minesPercent">0</span>%)</span>
        </span>
        <span>
          <span>Steps:</span><span id="steps">0</span><span title="Minimum possible">(<span id="perfect"></span>)</span></span>
        </span>
      </div>
    </div>
    <div class="tableBox">
      <div id="table"></div>
    </div>
<?php
if (isset($_GET['c']))
{
?>
    <canvas id="tableCanvas"></canvas>
<?php
}
?>
  </main>
  <header>
    <nav>
      <input id="main-menu" type="checkbox" data-popup="mainMenu">
      <label for="main-menu" class="close-overlay" title=""></label>
      <div class="menu popup">
        <header>Options</header>
        <div>
          <span>Size:</span>
          <span>
            <select id="width"></select> x <select id="height"></select>
            <!-- <input id="width" type="number" value="10"/> x <input id="height" type="number" value="10"/> -->
          </span>
        </div>
        <div>
          <span>Mines:</span>
          <span>
            <input id="mines" type="number" value="20"/>
          </span>
        </div>
        <div>
          <label title="Primary action"><input id="click" type="checkbox"><span>Click = open</span></label>
        </div>
      </div>
      <label for="main-menu" class="menu-icon" title="Menu">
        <span class="navicon" aria-label="Hamburger menu 'icon'"></span>
      </label>
    </nav>
  </header>
  <footer></footer>
  <div class="hidden"></div>
  <script type="text/javascript" src="js/main.js?<?=filemtime("js/main.js")?>"></script>
</body>

</html>