// jshint -W082
{
"use strict";

const elTable = document.getElementById("table"),
      elWidth = document.getElementById("width"),
      elHeight = document.getElementById("height"),
      elBombs = document.getElementById("bombs"),
      elReset  = document.getElementById("reset"),
      elBombsFound = document.getElementById("bombsFound"),
      elBombsTotal = document.getElementById("bombsTotal"),
      elClock = document.getElementById("clock"),
      BOMB = 9,
      OPEN = 16,
      FLAG = 32,
      OFFSET = [-1,-1,0,-1,1,-1,1,0,1,1,0,1,-1,1,-1,0], //offset around current coordinate
      settings = new Proxy(
      {
        width: {default: 10, value: 10, min: 2, max: 1000},
        height: {default: 10, value: 10, min: 2, max: 1000},
        bombs: {default: 3, value: 3, min: 1, max: 10000},
      },
      {
        get(target, prop, proxy)
        {
          if (prop === "init")
            return () => this.init(target);

          if (prop == "min" || prop == "max")
            return Object.keys(target).reduce((obj, key) => (obj[key] = target[key][prop], obj), {});

          return target[prop] && target[prop].value;
        },

        set(target, prop, value, proxy)
        {
          value = this.check(target, prop, value);
          if (value === undefined)
            return;

          target[prop].value = value;
          localStorage.setItem("mineSettings",  JSON.stringify(Object.keys(target).reduce((obj, key) => (obj[key] = target[key].value, obj), {})));
        },

        init(target)
        {
          const data = JSON.parse(localStorage.getItem("mineSettings")) || {};
          for(let i in target)
          {
            const value = this.check(target, i, data[i]);
            if (value === undefined)
              continue;

            target[i].value = value;
          }
          return target;
        },

        check(target, prop, value)
        {
          let res = prop in target && typeof target[prop].value == typeof value;
          if (res && "min" in target[prop] && value < target[prop].min)
            return target[prop].min;

          if (res && "max" in target[prop] && value > target[prop].max)
            return target[prop].max;

          return res ? value : undefined;
        }
      }),
      table = [],
      stats = {
        start: 0,
        bombs: 0,
        time: 0,
        timestamp: 0,
      };

settings.init();
init();

[...document.querySelectorAll(".control input")].map(el =>
{
  el.value = settings[el.id];
  el.min = settings.min[el.id];
  el.max = settings.max[el.id];
  
  // el.setAttribute("min", settings.min.width);
  // el.setAttribute("max", settings.max.width);
  el.addEventListener("input", e => 
  {
    settings[el.id] = +el.value;
    init();
  });
});

elReset.addEventListener("click", init);
elTable.addEventListener("click", onClick);
elTable.addEventListener("auxclick", onClick);
elTable.addEventListener("contextmenu", onClick);

function onClick(e)
{
  e.preventDefault();
  if (e.target === elTable || e.type == "contextmenu")
    return;

  const index = Array.from(elTable.children).indexOf(e.target),
        leftClick = e.type == "click";

  if (!stats.start)
    start();

console.log(e);
  let val = table[index];
  if ((leftClick && val & OPEN+FLAG) || (!leftClick && val & OPEN))
    return console.log("already clicked");

  if (leftClick && (val & 15) == BOMB)
    return gameover();

  if (leftClick)
    open(index);
  else
  {
    table[index] = val ^ FLAG;
    e.target.dataset.type = FLAG;
  }

  if (!(table[index] & OPEN + FLAG))
    delete e.target.dataset.type;

//  e.target.textContent = val;
}

function start(timestamp)
{
  if (timestamp === undefined)
    stats.start = new Date().getTime();

  if (timestamp - stats.timestamp > 10)
  {
    stats.timestamp = timestamp;
    if (stats.start)
    {
      stats.time = timestamp;
    }
    const msec = stats.start ? timestamp : stats.time;
    elClock.textContent = msec;
    elBombsFound.textContent = stats.bombs;
  }
  requestAnimationFrame(start);
}

function open(index)
{
  let array = [index];
  while(array.length)
  {
    index = array.pop();
    elTable.children[index].dataset.type = table[index] & 15;
    table[index] |= OPEN;
    if (table[index] != OPEN)
      continue;

    for(let o = 0; o < OFFSET.length; o+=2)
    {
      let i = getIndexOffset(index, OFFSET[o], OFFSET[o+1]),
          val = table[i]; //right

      if (val === undefined || val == BOMB || val & FLAG)
        continue;

      if (val === 0)
      {
        array[array.length] = i;
        continue;
      }
      
      if (!(val & OPEN))
      {
        if (val)
          elTable.children[i].dataset.type = val;

        table[i] |= OPEN;
      }
  
    }
  }

}

function gameover()
{
  console.log("game over");
  for(let i = 0; i < table.length; i++)
  {
    table[i] |= OPEN;
    elTable.children[i].dataset.type = table[i] & 15;
  }
}
function rand(min, max)
{
  return Math.round(Math.random() * (max - min) + min);
}

function init()
{
  stats.time = 0;
  stats.bombs = 0;
  stats.start = 0;
  table.length = 0; //reset
  table.length = settings.width * settings.height;
  const bombs = [],
        max = Math.min(settings.bombs, table.length - 1);

  while(bombs.length < max)
  {
    const bomb = rand(0, table.length-1);
    if (!bombs.includes(bomb))
      bombs[bombs.length] = bomb;
  }
  for(let i = 0; i < bombs.length; i++)
    table[bombs[i]] = BOMB;

  while(elTable.children.length > table.length)
    elTable.removeChild(elTable.lastChild);

  for(let i = 0; i < table.length; i++)
  {
    let bombsNum = 0;
    if (table[i] != BOMB)
    {
      for(let o = 0; o < OFFSET.length; o+=2)
      {
        let index = getIndexOffset(i, OFFSET[o], OFFSET[o+1]); //right
// console.log(i, index, bombs);
        if (table[index] == BOMB)
          bombsNum++;
      }
      table[i] = bombsNum;
    }
    const elCell = elTable.children[i] || document.createElement("span");
    if (!elCell.parentNode)
      elTable.appendChild(elCell);

    // elCell.textContent = table[i];
    delete elCell.dataset.type;
  }
  elTable.style.setProperty("--cols", settings.width);
  elTable.style.setProperty("--rows", settings.height);
  for(let i = 0; i < settings.height; i++)
  {
    console.log(table.slice(i * settings.width, i * settings.width + settings.width));
  }
  
  console.log(table);
  elBombsTotal.textContent = settings.bombs;
  start(0);
}// init();

function indexToXY(index, width = settings.width, height = settings.height)
{
  return {x: index % width, y: ~~(index / width)};
}
function getIndexOffset(index, offsetX, offsetY, width = settings.width, height = settings.height)
{
  let {x, y} = indexToXY(index, width, height);
  x += offsetX;
  y += offsetY;
  if (x < 0 || x > width-1 || y < 0 || y > height-1)
    return -1;

  return y * width + x;
}
}