<!DOCTYPE html>
<html>

<head>
  <meta http-equiv="content-type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mine'ish's</title>
  <link rel="stylesheet" media="screen" href="main.css?<?=filemtime("main.css")?>">
</head>

<body>
  <div class="control">
    <div>
      <span>Size:</span>
      <span>
        <input id="width" type="number"/> x <input id="height" type="number"/>
      </span>
    </div>
    <div>
      <span>Bombs:</span>
      <span>
        <input id="bombs" type="number"/>
      </span>
    </div>
    <div><span><button id="reset">Reset</button></span></div>
  </div>
  <div class="stats">
    <div><span>Time:</span><span id="clock">00:00:00</span></div>
    <div><span>Bombs:</span><span><span id="bombsFound"></span>/<span id="bombsTotal"></span></span></div>
  </div>
  <div id="table"></div>
  <script type="text/javascript" src="main.js?<?=filemtime("main.js")?>"></script>
</body>

</html>