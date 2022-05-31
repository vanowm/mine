<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="content-type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
  <title>Mine'er'ish</title>
  <link rel="stylesheet" media="screen" href="<?=getfile("css/font.css")?>">
  <link rel="stylesheet" media="screen" href="<?=getfile("css/mine.css")?>">
  <script type="text/javascript">
    window.mineTemp = {
      audio: ["<?=getfile("audio/dig.mp3")?>",
              "<?=getfile("audio/flag.mp3")?>",
              "<?=getfile("audio/flagoff.mp3")?>",
              "<?=getfile("audio/win.mp3")?>",
              "<?=getfile("audio/perfect.mp3")?>",
              "<?=getfile("audio/explode.mp3")?>"
              ].reduce((a,b) => (a[b.replace(/.*\/(.*)\.[^?]+\?.*/, "$1")] = new Audio(b), a), {}),
    }
  </script>
</head>

<body>
  <input id="main-menu" type="checkbox" data-popup="mainMenu">
  <header>
    <nav class="main-menu">
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
          <label title="Sound effects"><input id="audio" type="checkbox"><span>Sound</span></label>
        </div>
        <div>
          <label title="Primary action"><input id="click" type="checkbox"><span>Click = open</span></label>
        </div>
        <div>
          <label title="Monochrome mode"><input id="monochrome" type="checkbox"><span>Monochrome</span></label>
        </div>
        <div>
          <span>Animation speed:</span>
          <span>
            <select id="animation"></select>
          </span>
        </div>
        <div>
          <span>
            <button id="resetSettings">Reset</button>
          </span>
        </div>
      </div>
      <label for="main-menu" class="menu-icon" title="Menu">
        <span class="navicon" aria-label="Hamburger menu 'icon'"></span>
      </label>
    </nav>
  </header>
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
          <span>Steps:</span><span><span id="steps">0</span><span title="Minimum possible">(<span id="perfect"></span>)</span></span>
        </span>
      </div>
    </div>
    <div class="tableBox">
      <div class="borderOut">
        <div class="borderIn">
          <div id="table"></div>
        </div>
      </div>
    </div>
  </main>
  <?php
if (isset($_GET['c']))
{
?>
    <canvas id="tableCanvas"></canvas>
<?php
}
?>
  <footer></footer>
  <div class="hidden">
    <div id="imgFlag"></div>
    <div id="imgMine"></div>
  </div>
  <script type="text/javascript" src="<?=getfile("js/mine.js")?>"></script>
</body>

</html>