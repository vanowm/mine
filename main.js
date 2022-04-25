// jshint -W082
{
"use strict";

const EL = new Proxy({},{get(target, prop){return prop in target ? target[prop] : (target[prop] = document.getElementById(prop));}}),
      MINE = 9,
      OPEN = 16,
      SHOW = 32,
      FLAG = 64,
      TYPE = OPEN - 1,
      OFFSET = [-1,-1,0,-1,1,-1,1,0,1,1,0,1,-1,1,-1,0], //offset around current coordinate
      anim = {
        clock: [],
        shake: 0,
      },
      settings = new Proxy(
      {
        width: {default: 10, value: 10, min: 2, max: 300},
        height: {default: 10, value: 10, min: 2, max: 300},
        mines: {default: 20, value: 20, min: 1, max: 9998},
        zoom: {default: 2.5, value: 2.5, min: 1, max: 20},
        click: {default: true, value: true},
        startOpen: {default: true, value: true},
        table: {default: [], value: []},
        stats: {
          start: 0,
          mines: 0,
          time: 0,
          timestamp: 0,
          open: 0,
          pauseTime: 0,
          pauseStart: 0,
          steps: [] //list of indexes, bit1 = flag
        }
      },
      {
        get(target, prop, proxy)
        {
          if (prop === "init")
            return () => this.init(target);

          if (prop == "save")
            return this.save(target);

          if (["min", "max", "default"].includes(prop))
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

          if (value === undefined)
            return;

          target[prop].value = value;
          return this.save(target);
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

        save(target)
        {
          return localStorage.setItem("mineSettings",  JSON.stringify(Object.keys(target).reduce((obj, key) =>
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

        check(target, prop, value)
        {
          let res = prop in target && target[prop] !== null && (typeof target[prop].value == typeof value || typeof target[prop] == typeof value);
          if (res && target[prop] instanceof Object && target[prop] !== null && "min" in target[prop] && value < target[prop].min)
            return target[prop].min;

          if (res && target[prop] instanceof Object && target[prop] !== null && "max" in target[prop] && value > target[prop].max)
            return target[prop].max;

          return res ? value : undefined;
        }
      });

let dragScroll = false;
settings.init();
setZoom();
[...document.querySelectorAll(".control input, .control select")].map(el =>
{
  if (el.type == "checkbox")
  {
    el.checked = settings[el.id];
  }
  else if (el.tagName == "SELECT")
  {
    let option = document.createElement("option");
    for(let i = settings.min[el.id],  def = settings.default[el.id]; i <= settings.max[el.id]; i++)
    {
      option = option.cloneNode(true);
      option.textContent = i;
      option.value = i;
      option.className = i == def ? "default" : "";
      el.appendChild(option);
    }
    el.value = settings[el.id];
  }
  else
  {
    el.value = settings[el.id];
    el.min = settings.min[el.id];
    el.max = el.id == "mines" ? settings.width * settings.height - 1 : settings.max[el.id];

  }
  let timer, timerFilter;
  el.addEventListener("input", e => 
  {
    const isCheckbox = el.type == "checkbox",
          isSelect = el.tagName  == "SELECT",
          value = isCheckbox ? el.checked : isSelect ? ~~el.value : Math.max(el.min, Math.min( ~~el.value, el.max));

    if (!isCheckbox && !isSelect)
    {
      clearTimeout(timerFilter);
      if (el.value != value)
      {
        timerFilter = setTimeout(() => (el.value = value, init(true)), 3000);
      }
    }
    settings[el.id] = value;
    if (isCheckbox)
      return;

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
    timer = setTimeout(() => init(true), isSelect ? 0 : 300);

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

  window.addEventListener("wheel", e =>
  {
    if (!e.ctrlKey)
      return;
    
    e.preventDefault();
    e.stopPropagation();
    let zoom = parseFloat(getComputedStyle(document.body).getPropertyValue("--zoom"));
    // EL.difficulty.textContent = [settings.zoom, settings.min.zoom, settings.max.zoom];

    zoom += e.deltaY < 0 ? 0.3 : -0.3;
    if (zoom < settings.min.zoom)
      zoom = settings.min.zoom;

    if (zoom > settings.max.zoom)
      zoom = settings.max.zoom;

    settings.zoom = zoom;
    timer = setTimeout(setZoom, 10);

  },{passive: false});

  const SCALE_X = 1,
        SCALE_Y = 1,
        tableBox = EL.table.parentNode;

  let clientX = 0,
      clientY = 0,
      mouseDown = null;

  const onMouseMove = e =>
  {
    if (e.timeStamp - mouseDown.timeStamp < 100000 /*this can be removed*/
         && ((dragScroll && e.clientX == clientX && e.clientY == clientY)
            || (!dragScroll && Math.hypot(e.clientX - clientX, e.clientY - clientY) < 8))) //allow 6px movement
      return;

    if (!dragScroll)
    {
      // ({clientX, clientY} = e);
    }

    document.body.classList.add("dragging");
    tableBox.scrollBy(SCALE_X * (clientX - e.clientX), SCALE_Y * (clientY - e.clientY));
    dragScroll = true;
    // mouseDown.preventDefault();
    // mouseDown.stopPropagation();
    ({clientX, clientY} = e);

  };
  const onMouseUp = e =>
  {
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("mousemove", onMouseMove);
    document.body.classList.remove("drag");
    document.body.classList.remove("dragging");
    // if (dragScroll)
    // {
    //   e.preventDefault();
    //   e.stopPropagation();
    //   console.log(e);
    // }

  };

  EL.table.addEventListener("mousedown", e =>
  {
    mouseDown = e;
    dragScroll = false;
    ({clientX, clientY} = e);
    e.preventDefault();
    document.body.classList.add("drag");
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
  });
}
EL.reset.addEventListener("click", init);
EL.table.addEventListener("click", onClick);
EL.table.addEventListener("auxclick", onClick);
EL.table.addEventListener("contextmenu", onClick);
EL.pause.addEventListener("click", e =>
{
  pause();
});




init(!settings.table.length);

function pause(p)
{
  if (p === undefined)
  {
    p = !settings.stats.pauseTime;
    if (p && !settings.stats.start)
      return;
  }

  document.body.classList.toggle("pause", p ? true : false);
  if (p)
  {
    if (!settings.stats.start)
      return;

    settings.stats.pauseTime = new Date().getTime();
    settings.stats.pauseStart = settings.stats.start;
    settings.stats.start = 0;
  }
  else
  {
    if (settings.stats.pauseTime )
      settings.stats.start = new Date().getTime() - settings.stats.pauseTime  + settings.stats.pauseStart ;

    settings.stats.pauseTime  = 0;
  }
  settings.save;
}

function setZoom(z)
{
  if (z === undefined)
    z = settings.zoom;

  document.body.style.setProperty("--zoom", z +"em");

}

function onClick(e)
{
  e.preventDefault();

  if (dragScroll || e.target === EL.table || (e.type == "auxclick" && e.button == 2) || (!settings.stats.start && settings.stats.time))
    return;

  const index = Array.from(EL.table.children).indexOf(e.target),
        leftClick = settings.click ? e.type == "click" : e.type != "click";

  let val = settings.table[index];
  if ((leftClick && (val & OPEN || val & FLAG || val & SHOW)) || (!leftClick && val & OPEN))
    return console.log("already clicked");

  settings.stats.steps[settings.stats.steps.length] = (index << 1) | !leftClick; //set bit1 = flag

  if (!settings.stats.start)
    start();

  if (leftClick)
  {
    open(index);
    if ((val & TYPE) == MINE)
      return finished();
  }
  else
  {
    settings.table[index] ^= FLAG;
    e.target.dataset.type = FLAG;
    settings.stats.mines += val & FLAG ? -1 : 1;
  }

  if (!(settings.table[index] & OPEN + FLAG))
    delete e.target.dataset.type;

  if (isWon())
    finished(true);

  settings.save;
  //  e.target.textContent = val;
}

function finished(won)
{
  EL.table.classList.add("finished");
  if (won)
  {
    console.log("you win!");
    EL.table.classList.add("won");

  }
  else
  {
    console.log("game over");
  }
  for(let i = 0; i < settings.table.length; i++)
  {
    const cell = EL.table.children[i];
    cell.classList.add("opened");
    if (!(settings.table[i] & OPEN+FLAG))
    {
      settings.table[i] |= SHOW;
      cell.classList.add("shown");
    }
    const type = settings.table[i] & TYPE;
    cell.dataset.type = type;
    if (settings.table[i] & FLAG)
      cell.classList.add("flag");

  }
  EL.table.children[settings.stats.steps[settings.stats.steps.length - 1]>>1].classList.add("last");
  settings.stats.start = 0;
  settings.save; //save settings
}

function isFinished()
{
  let good = 0,
      killed = 0;

  for(let i = 0; i < settings.table.length; i++)
  {
    const val = settings.table[i],
          type = val & TYPE,
          isFlag = val & FLAG,
          isOpen = val & OPEN,
          isShow = val & SHOW;

    if (type == MINE && isFlag || (type != MINE && !isFlag && isOpen))
      good++;

    if (isShow || (isOpen && type == MINE & !isFlag))
      killed = 2;
  }
  return good == settings.table.length ? 1 : killed;
}
function isWon()
{
  for(let i = 0; i < settings.table.length; i++)
  {
    const val = settings.table[i],
          type = val & TYPE;

    if (val & SHOW || (!(type != MINE && val & OPEN) && !(type == MINE && val & FLAG)))
      return false;
  }
  return true;
}

function start(timestamp)
{
  if (timestamp === undefined)
    settings.stats.start = new Date().getTime();

  if (timestamp - settings.stats.timestamp > 15)
  {
    settings.stats.timestamp = timestamp;
    if (settings.stats.start)
      settings.stats.time = new Date().getTime() - settings.stats.start;

    let time = getTime(settings.stats.time).split(/[:.]/);
    for(let i = 0; i < time.length; i++)
    {
      if (anim.clock[i] != time[i])
      {
        anim.clock[i] = time[i];
        EL.clock.children[i].textContent = time[i];
      }
    }

    EL.minesFound.textContent = settings.stats.mines;
    EL.minesPercent.textContent = Math.round(settings.stats.mines * 100 / settings.mines); 
    EL.steps.textContent = settings.stats.steps.length;
    EL.clock.classList.toggle("blink", time[3] > 500);
  }
  if (!anim.shake || timestamp - anim.shake > 1000)
  {
    anim.shake = timestamp;
    let frames = "";
    for(let i = 0; i < 101; i += 10)
    {
      frames += `${i}%{transform:translate(${~~(Math.random() * 10 -5)/60}em,${~~(Math.random() * 10 -5)/60}em) rotate(${~~(Math.random() * 10 -5)}deg);}`;
    }
    EL.shake.textContent = `@keyframes shake{${frames}}`;
    
    // document.body.style.setProperty("--shakeX", ~~(Math.random() * 10 -5) + "px" );
    // document.body.style.setProperty("--shakeY", ~~(Math.random() * 10 -5) + "px" );
    // document.body.style.setProperty("--shakeR", ~~(Math.random() * 4 -2) + "deg" );

  }
  // if (timestamp - anim.timers.blink > 1000)
  // {
  //   anim.timers.blink = timestamp;
  //   anim.blink = settings.stats.start && !anim.blink;
  //   EL.clock.classList.toggle("blink", anim.blink);
  // }
  requestAnimationFrame(start);
}

function getTime(time)
{
  return time > 8553599999 ? "99:59:59.999" : new Date(time).toISOString().replace(/(\d+)T(\d+)/, (a,b,c) => (~~b-1? ("0"+Math.min(((~~b-1)*24+~~c), 99)).substr(-2) : c)).substring(8, 20);
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
  EL.table.className = "";
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
      elCell.className = "";
    }
    else
    {
      if (settings.table[i] & OPEN || settings.table[i] & SHOW)
      {
        elCell.classList.add("opened");
        elCell.dataset.type = settings.table[i] & TYPE;
        started = true;
      }
      if(settings.table[i] & FLAG)
      {
        elCell.dataset.type = FLAG;
        flags++;
        started = true;
      }
      if ((settings.table[i] & TYPE) == MINE)
        mines++;
    }
  }
  // if (flags !== settings.stats.mines)
  // {
  //   settings.stats.mines = flags;
  // }
  if (started)
    start(0);

  document.body.style.setProperty("--cols", settings.width);
  document.body.style.setProperty("--rows", settings.height);
  // for(let i = 0; i < settings.height; i++)
  //   console.log(settings.table.slice(i * settings.width, i * settings.width + settings.width));
  
  EL.minesTotal.textContent = settings.mines;
  settings.table = settings.table; //save settings
  start(0);
  const finish = isFinished();
  if (finish)
    finished(finish == 1);

  EL.difficulty.textContent = ["Can't loose", "Don't wanna think", "Super easy", "Easy", "Normal", "Medium", "Hard", "Very hard", "I can do this!", "I'll try it anyway", "Impossible", "Gotta buy a lottery"][Math.min(~~(difficulty() * 3 / 11), 11)];// + " [" + ~~(difficulty()) + "%]";
  EL.difficulty.dataset.value = ~~(difficulty() + 1);

  let empty = [];
  for(let i = 0; i < settings.table.length; i++)
  {
    if (!settings.table[i])
      empty[empty.length] = i;
  }
  if (!started && difficulty() > 21 && settings.startOpen)
  {
    empty = empty[~~(rand(0, empty.length-1))];
    if (empty !== undefined)
      open(empty);

  }
  pause(settings.stats.pauseTime);
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
  const r = [],
        bits = Math.log2(FLAG) + 1,
        max = ~~(32 / bits);

  for(let i = 0; i < val.length; i+=max)
  {
    let v = 0;
    for(let n = 0; n < max; n++) //combine 4 6-bit numbers into 1 32-bit
    {
      v |= ~~val[i + n] << ((max-1-n)*bits);
    }

    r[r.length] = v;
  }
  return r + "";
}

function decode(val)
{
  val = ("" + val).split(",").map(a => ~~a);
  let r = [],
      bits = Math.log2(FLAG) + 1,
      max = ~~(32 / bits),
      mask = (FLAG << 1) - 1;

  for(let i = 0; i < val.length; i++)
  {
    let id = (i+1) * max;
    for(let n = 0; n < max; n++)
      r[id-n-1] = val[i] >> n*bits & mask;
  }
  return r;
}
}