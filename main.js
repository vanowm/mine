// jshint -W082
{
"use strict";

const EL = new Proxy({},{get(target, prop){return prop in target ? target[prop] : (target[prop] = document.getElementById(prop));}}),
      MINE = 9,
      OPEN = 16,
      FLAG = 32,
      TYPE = OPEN - 1,
      OFFSET = [-1,-1,0,-1,1,-1,1,0,1,1,0,1,-1,1,-1,0], //offset around current coordinate
      anim = {
        blink: false,
        timers: {
          blink: 0
        }
      },
      settings = new Proxy(
      {
        width: {default: 10, value: 10, min: 2, max: 300},
        height: {default: 10, value: 10, min: 2, max: 300},
        mines: {default: 20, value: 20, min: 1, max: 9998},
        zoom: {default: 2.5, value: 2.5, min: 1, max: 7},
        table: {default: [], value: []},
        stats: {
          start: 0,
          mines: 0,
          time: 0,
          timestamp: 0,
          open: 0,
          steps: []
        }
      },
      {
        get(target, prop, proxy)
        {
          if (prop === "init")
            return () => this.init(target);

          if (prop == "min" || prop == "max")
            return Object.keys(target).reduce((obj, key) => 
            {
              if (key == "mines" && prop == "max")
              {
                target[key][prop] = target.width.value * target.height.value - 1;
              }
              obj[key] = target[key][prop];
              return obj;
            }, {});

          return target[prop] && (target[prop].value === undefined ? target[prop] : target[prop].value);
        },

        set(target, prop, value, proxy)
        {
          value = this.check(target, prop, value);

console.log(prop, value);
          if (value === undefined)
            return;

          target[prop].value = value;
          localStorage.setItem("mineSettings",  JSON.stringify(Object.keys(target).reduce((obj, key) =>
          {
            let val = target[key].value;
            if (key == "table")
              val = encode(val);

            if (val === undefined)
              val = target[key];

            obj[key] = val;
            return obj;
          }, {})));
        },

        init(target, data)
        {
          if (data === undefined)
            data = JSON.parse(localStorage.getItem("mineSettings")) || {};

          for(let i in target)
          {
            if (i == "table" && data[i])
            {
              data[i] = decode(data[i]);
            }
            let value = this.check(target, i, data[i]),
                obj = false;
            if (value !== null && value instanceof Object && !(value instanceof Array))
            {
              value = this.init(value, value);
              obj = true;
            }

            if (value === undefined)
              continue;

            if (obj)
              target[i] = value;
            else
              target[i].value = value;
          }
          return target;
        },

        load(target)
        {

        },

        check(target, prop, value)
        {
console.log(prop, value, target);
          let res = prop in target && target[prop] !== null && (typeof target[prop].value == typeof value || typeof target[prop] == typeof value);
          if (res && target[prop] instanceof Object && target[prop] !== null && "min" in target[prop] && value < target[prop].min)
            return target[prop].min;

          if (res && target[prop] instanceof Object && target[prop] !== null && "max" in target[prop] && value > target[prop].max)
            return target[prop].max;

          return res ? value : undefined;
        }
      });

settings.init();
setZoom();
init(!settings.table.length);

[...document.querySelectorAll(".control input")].map(el =>
{
  el.value = settings[el.id];
  el.min = settings.min[el.id];
  el.max = el.id == "mines" ? settings.width * settings.height - 1 : settings.max[el.id];
  
  let timer, timerFilter;
  el.addEventListener("input", e => 
  {
    const value = Math.max(el.min, Math.min( ~~el.value, el.max));
    clearTimeout(timerFilter);
    if (el.value != value)
    {
      timerFilter = setTimeout(() => (el.value = value, init(true)), 3000);
    }

    settings[el.id] = value;
    if (el.id != "mines")
    {
      const max = settings.width * settings.height - 1;
      EL.mines.max = max;
      if (~~EL.mines.value > max)
      {
        settings.mines = max;
        EL.mines.value = max;
      }
    }
    clearTimeout(timer);
    timer = setTimeout(() => init(true), 300);
  });
});

{
  let scaling = false;

  window.addEventListener("touchstart", e =>
  {

    if (e.touches.length === 2)
    {
      scaling = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      last = scaling;
      e.preventDefault();
    }
  });
  window.addEventListener("touchmove", e =>
  {
    if (!scaling)
    return;
    
    e.preventDefault();
    const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
    let zoom = parseFloat(getComputedStyle(document.body).getPropertyValue("--zoom"));
    // EL.difficulty.textContent = [settings.zoom, settings.min.zoom, settings.max.zoom];

    if (Math.abs(dist - scaling) > 10)
    {
      zoom += dist - scaling > 0 ? 0.3 : -0.3;
      if (zoom < settings.min.zoom)
        zoom = settings.min.zoom;

      if (zoom > settings.max.zoom)
        zoom = settings.max.zoom;

      scaling = dist;
      settings.zoom = zoom;
      timer = setTimeout(setZoom, 10);
    }

  },{passive: false});
  window.addEventListener("touchend", e =>
  {
    if (!scaling)
      return;

    scaling = false;
  });

}
EL.reset.addEventListener("click", init);
EL.table.addEventListener("click", onClick);
EL.table.addEventListener("auxclick", onClick);
EL.table.addEventListener("contextmenu", onClick);

function setZoom(z)
{
  if (z === undefined)
    z = settings.zoom;

  document.body.style.setProperty("--zoom", z +"em");

}

function onClick(e)
{
  e.preventDefault();
  if (e.target === EL.table || (e.type == "auxclick" && e.button == 2) || (!settings.stats.start && settings.stats.time))
    return;

  const index = Array.from(EL.table.children).indexOf(e.target),
        leftClick = e.type == "click";

  let val = settings.table[index];
  if ((leftClick && val & OPEN+FLAG) || (!leftClick && val & OPEN))
    return console.log("already clicked");

  settings.stats.steps[settings.stats.steps.length] = index;
  if (leftClick && (val & TYPE) == MINE)
    return finished();

  if (!settings.stats.start)
    start();

  if (leftClick)
    open(index);
  else
  {
    settings.table[index] = val ^ FLAG;
    e.target.dataset.type = FLAG;
    settings.stats.mines += val & FLAG ? -1 : 1;
  }

  if (!(settings.table[index] & OPEN + FLAG))
    delete e.target.dataset.type;

  if (isWon())
    finished(true);

  settings.table = settings.table;
  //  e.target.textContent = val;
}

function finished(won)
{
  if (won)
  {
    console.log("you win!");
    EL.table.classList.add("finished");
    for(let i = 0; i < settings.table.length; i++)
      EL.table.children[i].dataset.type = settings.table[i] & TYPE;

  }
  else
  {
    console.log("game over");
    for(let i = 0; i < settings.table.length; i++)
    {
      settings.table[i] |= OPEN;
      EL.table.children[i].dataset.type = settings.table[i] & TYPE;
      EL.table.children[i].classList.add("opened");
    }
  }
  settings.stats.start = 0;
  settings.table = settings.table; //save settings
}

function isWon()
{
  for(let i = 0; i < settings.table.length; i++)
  {
    const val = settings.table[i],
          type = val & TYPE;

    if (!(type != MINE && val & OPEN) && !(type == MINE && val & FLAG))
      return false;
  }
  return true;
}

function start(timestamp)
{
  if (timestamp === undefined)
  {
    settings.stats.start = new Date().getTime();
  }

  if (timestamp - settings.stats.timestamp > 15)
  {
    settings.stats.timestamp = timestamp;
    if (settings.stats.start)
    {
      settings.stats.time = new Date().getTime() - settings.stats.start;
    }
    let time = getTime(settings.stats.time).split(":");
    for(let i = 0; i < time.length; i++)
      EL.clock.children[i].textContent = time[i];

    EL.minesFound.textContent = settings.stats.mines;
    EL.minesPercent.textContent = Math.round(settings.stats.mines * 100 / settings.mines); 
    EL.steps.textContent = settings.stats.steps.length;
  }
  if (timestamp - anim.timers.blink > 500)
  {
    anim.timers.blink = timestamp;
    anim.blink = settings.stats.start && !anim.blink;
    EL.clock.classList.toggle("blink", anim.blink);
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
    EL.table.children[index].dataset.type = settings.table[index] & TYPE;
    EL.table.children[index].classList.add("opened")
    if (!(settings.table[index] & OPEN))
      settings.stats.open++;

    settings.table[index] |= OPEN;
    if (settings.table[index] != OPEN)
      continue;

    for(let o = 0; o < OFFSET.length; o+=2)
    {
      let i = getIndexOffset(index, OFFSET[o], OFFSET[o+1]),
          val = settings.table[i]; //right

      if (val === undefined || val == MINE || val & FLAG)
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

        if (!(settings.table[i] & OPEN))
          settings.stats.open++;

        settings.table[i] |= OPEN;
        EL.table.children[i].classList.add("opened");
      }
  
    }
  }

}


function rand(min, max)
{
  return Math.round(Math.random() * (max - min) + min);
}

function init(reset = false)
{
  EL.table.classList.remove("finished");
  settings.stats.timestamp = 0;
  let opened = false;
  for(let i = 0, mask = OPEN + FLAG; i < settings.table.length; i++)
  {
    if (settings.table[i] & mask)
    {
      opened = true;
      break;
    }
  }
  if(!opened)
    reset = true;

  if (reset)
  {
    for(let i in settings.stats)
      settings.stats[i] = 0;

    settings.stats.steps = [];
    settings.table.length = 0; //reset
  }

  settings.table.length = settings.width * settings.height;
  if (reset)
  {
    const mines = [],
          max = Math.min(settings.mines, settings.table.length - 1);

    while(mines.length < max)
    {
      const mine = rand(0, settings.table.length-1);
      if (!mines.includes(mine))
        mines[mines.length] = mine;
    }
    for(let i = 0; i < mines.length; i++)
      settings.table[mines[i]] = MINE;
  }
  while(EL.table.children.length > settings.table.length)
    EL.table.removeChild(EL.table.lastChild);

  let started = false,
      flags = 0,
      mines = 0;

  for(let i = 0; i < settings.table.length; i++)
  {
    if (reset)
    {
      let minesNum = 0;
      if (settings.table[i] != MINE)
      {
        for(let o = 0; o < OFFSET.length; o+=2)
        {
          let index = getIndexOffset(i, OFFSET[o], OFFSET[o+1]); //right
  // console.log(i, index, mines);
          if (settings.table[index] == MINE)
            minesNum++;
        }
        settings.table[i] = minesNum;
      }
    }
    const elCell = EL.table.children[i] || document.createElement("span");
    if (!elCell.parentNode)
      EL.table.appendChild(elCell);

    if (reset)
    {
      // elCell.textContent = table[i];
      delete elCell.dataset.type;
      elCell.classList.remove("opened");
    }
    else
    {
      if (settings.table[i] & OPEN)
      {
        elCell.classList.add("opened");
        elCell.dataset.type = settings.table[i] & TYPE;
        started = true;
      }
      else if(settings.table[i] & FLAG)
      {
        elCell.dataset.type = FLAG;
        flags++;
      }
      if ((settings.table[i] & TYPE) == MINE)
        mines++;
    }
  }
  // if (flags !== settings.stats.mines)
  // {
  //   settings.stats.mines = flags;
  // }
console.log(flags, settings.stats.mines, mines, settings.mines);
  if (started)
    start(0);

  document.body.style.setProperty("--cols", settings.width);
  document.body.style.setProperty("--rows", settings.height);
  // for(let i = 0; i < settings.height; i++)
  //   console.log(settings.table.slice(i * settings.width, i * settings.width + settings.width));
  
  EL.minesTotal.textContent = settings.mines;
  settings.table = settings.table; //save settings
  start(0);
  if (isWon())
    finished(true);

  EL.difficulty.textContent = ["Can't loose", "Don't wanna think", "Super easy", "Easy", "Normal", "Medium", "Hard", "Very hard", "I can do this!", "I'll try it anyway", "Impossible", "Gotta buy a lottery"][Math.min(~~(difficulty() * 2 / 11), 11)];// + " [" + ~~(difficulty()) + "%]";
  EL.difficulty.dataset.value = ~~(difficulty() + 1);
}// init();

function difficulty()
{
  return settings.mines * 100 / (settings.width * settings.height);
}

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

function encode(val)
{
  const r = [];
  for(let i = 0; i < val.length; i+=5)
  {
    let v = 0;
    for(let n = 0; n < 5; n++) //combine 4 6-bit numbers into 1 32-bit
      v |= ~~val[i + n] << ((4-n)*6);

    r[r.length] = v;
  }
  return r + "";
}

function decode(val)
{
  val = ("" + val).split(",").map(a => ~~a);
  let r = [];
  for(let i = 0; i < val.length; i++)
  {
    let id = (i+1) * 5;
    for(let n = 0; n < 5; n++)
      r[id-n-1] = val[i] >> n*6 & 63;
  }
  return r;
}

}