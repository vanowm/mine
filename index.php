<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="content-type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
  <meta name="color-scheme" content="light dark">
  <title>Mine'er'ish</title>
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
        <div class="menu-content">
          <div>
            <span>Presets:</span>
            <span>
              <select id="presets"></select>
            </span>
          </div>
          <div>
            <span>Size:</span>
            <span class="sizeBox">
              <select id="width"></select> x <select id="height"></select>
            </span>
          </div>
          <table>
            <tr>
              <td>⛯ Mines:</td>
              <td>
                <select id="mines"></select>
              </td>
              <td id="menuDifficulty" rowspan="2"></td>
            </tr>
            <tr>
              <td>☁ Rocks:</td>
              <td>
                <select id="rocks"></select>
              </td>
            </tr>
          </table>
          <div>
            <label title="Must mark all mines with flag?"><input id="flagRequire" type="checkbox"><span>Flags require</span></label>
          </div>
          <div>
            <label title="Sound effects"><input id="audio" type="checkbox"><span>Sound</span></label>
          </div>
          <div>
            <label title="Show steps when finished"><input id="showSteps" type="checkbox"><span>Show steps</span></label>
          </div>
          <div>
            <label title="Third right click = question mark"><input id="questionMark" type="checkbox"><span>Enable question mark</span></label>
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
      </div>
      <label for="main-menu" class="menu-icon" title="Menu">
        <span class="navIcon" aria-label="Hamburger menu 'icon'"></span>
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
        <span class="clock">
          <span>Time:</span><span id="clock" class="digit clock"><span data-time="d"></span><span data-time="h">00</span><span data-time="m">00</span><span data-time="s">00</span><span data-time="ms">000</span></span>
        </span>
        <span class="game">
          <span>Progress:</span><span><span id="gamePercent" class="digit">0</span>%<!--/<span id="minesTotal" class="digit">0</span>--></span>
        </span>
        <span class="mines">
          <span>Mines:</span><span><span id="minesFound" class="digit">0</span><!--/<span id="minesTotal" class="digit">0</span>--></span>
        </span>
        <span class="steps">
          <span>Steps:</span><span><span id="steps" class="digit">0</span><span title="Minimum possible">(<span id="perfect" class="digit"></span>)</span></span>
        </span>
      </div>
    </div>
    <div class="tableBox">
      <div class="borderOut">
        <div class="borderIn">
          <canvas id="table"></canvas>
        </div>
      </div>
    </div>
  </main>
  <footer>
    <div class="statsBoard">
      <table class="statsBoardBox">
        <tr><th colspan="4">This Board</th><td class="clear board"></td></tr>
        <tr>
          <td>Games:</td><td id="stats_games" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Wins:</td><td id="stats_wins" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Loses:</td><td id="stats_loses" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Perfect games:</td><td id="stats_perfect" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Time:</td><td id="stats_time" class="clock digit"><span data-time="d"></span><span data-time="h">00</span><span data-time="m">00</span><span data-time="s">00</span><span data-time="ms">000</span></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Steps:</td><td id="stats_steps" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Opened:</td><td id="stats_clicked" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Flags:</td><td id="stats_flags" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Questions:</td><td id="stats_questions" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Best Time:</td><td id="stats_best" class="clock digit"><span data-time="d"></span><span data-time="h">00</span><span data-time="m">00</span><span data-time="s">00</span><span data-time="ms">000</span></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Worst Time:</td><td id="stats_worst" class="clock digit"><span data-time="d"></span><span data-time="h">00</span><span data-time="m">00</span><span data-time="s">00</span><span data-time="ms">000</span></td><td class="extra" colspan="2"></td>
        </tr>
      </table>
      <table class="statsBoardBox">
        <tr><th colspan="4">Total</th><td class="clear"></td></tr>
        <tr>
          <td>Games:</td><td id="stats_all_games" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Wins:</td><td id="stats_all_wins" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Loses:</td><td id="stats_all_loses" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Perfect games:</td><td id="stats_all_perfect" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Time:</td><td id="stats_all_time" class="clock digit"><span data-time="d"></span><span data-time="h">00</span><span data-time="m">00</span><span data-time="s">00</span><span data-time="ms">000</span></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Steps:</td><td id="stats_all_steps" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Opened:</td><td id="stats_all_clicked" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Flags:</td><td id="stats_all_flags" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Questions:</td><td id="stats_all_questions" class="digit"></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Best Time:</td><td id="stats_all_best" class="clock digit"><span data-time="d"></span><span data-time="h">00</span><span data-time="m">00</span><span data-time="s">00</span><span data-time="ms">000</span></td><td class="extra" colspan="2"></td>
        </tr>
        <tr>
          <td>Worst Time:</td><td id="stats_all_worst" class="clock digit"><span data-time="d"></span><span data-time="h">00</span><span data-time="m">00</span><span data-time="s">00</span><span data-time="ms">000</span></td><td class="extra" colspan="2"></td>
        </tr>
      </table>
    </div>
  </footer>
  <div class="hidden">
    <div id="imgFlag"></div>
    <div id="imgFlagGood"></div>
    <div id="imgFlagBad"></div>
    <div id="imgQuestion"></div>
    <div id="imgMine"></div>
  </div>
  <script type="text/javascript" src="<?=getfile("js/mine.js")?>"></script>
</body>

</html>