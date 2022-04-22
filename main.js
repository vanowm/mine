// jshint -W082
{
"use strict";

const EL = new Proxy({},{get(target, prop){return prop in target ? target[prop] : (target[prop] = document.getElementById(prop));}}),
      BOMB = 9,
      OPEN = 16,
      FLAG = 32,
      OFFSET = [-1,-1,0,-1,1,-1,1,0,1,1,0,1,-1,1,-1,0], //offset around current coordinate
      settings = new Proxy(
      {
        width: {default: 10, value: 10, min: 2, max: 1000},
        height: {default: 10, value: 10, min: 2, max: 1000},
        bombs: {default: 30, value: 30, min: 1, max: 10000},
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
        open: 0
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

EL.reset.addEventListener("click", init);
EL.table.addEventListener("click", onClick);
EL.table.addEventListener("auxclick", onClick);
EL.table.addEventListener("contextmenu", onClick);

function onClick(e)
{
  e.preventDefault();
  if (e.target === EL.table || (e.type == "auxclick" && e.button == 2) || (!stats.start && stats.time))
    return;

  console.log(e.type, e.button);
  const index = Array.from(EL.table.children).indexOf(e.target),
        leftClick = e.type == "click";

  let val = table[index];
  if ((leftClick && val & OPEN+FLAG) || (!leftClick && val & OPEN))
    return console.log("already clicked");

  if (leftClick && (val & 15) == BOMB)
    return gameover();

  if (!stats.start)
  start();

  if (leftClick)
    open(index);
  else
  {
    table[index] = val ^ FLAG;
    e.target.dataset.type = FLAG;
    stats.bombs += val & FLAG ? -1 : 1;
  }

  if (!(table[index] & OPEN + FLAG))
    delete e.target.dataset.type;

  if (stats.open + stats.bombs == settings.width * settings.height)
  {
    EL.table.classList.add("finished");
    for(let i = 0; i < table.length; i++)
      EL.table.children[i].dataset.type = table[i] & 15;

    console.log("you win!");
    stats.start = 0;
  }
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
      stats.time = new Date().getTime() - stats.start;
    }
    EL.clock.textContent = getTime(stats.time);
    EL.bombsFound.textContent = stats.bombs;
  }
  requestAnimationFrame(start);
}

function getTime(time)
{
  return time > 8553599999 ? "99:59:59.999" : new Date(time).toISOString().replace(/(\d+)T(\d+)/, (a,b,c) => (~~b-1? ("0"+Math.min(((~~b-1)*24+~~c), 99)).substr(-2) : c)).substr(8, 12);
}

function open(index)
{
  let array = [index];
  while(array.length)
  {
    index = array.pop();
    EL.table.children[index].dataset.type = table[index] & 15;
    EL.table.children[index].classList.add("opened")
    if (!(table[index] & OPEN))
      stats.open++;

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
          EL.table.children[i].dataset.type = val;

        if (!(table[i] & OPEN))
          stats.open++;

        table[i] |= OPEN;
        EL.table.children[i].classList.add("opened");
      }
  
    }
  }

}

function gameover()
{
  console.log("game over");
  stats.start = 0;
  for(let i = 0; i < table.length; i++)
  {
    table[i] |= OPEN;
    EL.table.children[i].dataset.type = table[i] & 15;
    EL.table.children[i].classList.add("opened");
  }
}
function rand(min, max)
{
  return Math.round(Math.random() * (max - min) + min);
}

function init()
{
  for(let i in stats)
    stats[i] = 0;

  EL.table.classList.remove("finished");
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

  while(EL.table.children.length > table.length)
    EL.table.removeChild(EL.table.lastChild);

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
    const elCell = EL.table.children[i] || document.createElement("span");
    if (!elCell.parentNode)
      EL.table.appendChild(elCell);

    // elCell.textContent = table[i];
    delete elCell.dataset.type;
    elCell.classList.remove("opened");
  }
  EL.table.style.setProperty("--cols", settings.width);
  EL.table.style.setProperty("--rows", settings.height);
  for(let i = 0; i < settings.height; i++)
  {
    console.log(table.slice(i * settings.width, i * settings.width + settings.width));
  }
  
  console.log(table);
  EL.bombsTotal.textContent = settings.bombs;
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