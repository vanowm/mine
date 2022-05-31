// jshint -W082,-W014, -W083
{
  "use strict";
  const EL = new Proxy(
        {
          get get()
          {
            return new Proxy({},
            {
              get(target,prop,proxy)
              {
                return document.getElementById(prop) || document.querySelector(prop);
              },
            });
          },
          get all()
          {
            return new Proxy({},
            {
              get(target,prop,proxy)
              {
                return document.querySelectorAll(prop);
              },
            });
          },
          get updateCache()
          {
            const target = this;
            return new Proxy({},
            {
              get(t,prop,proxy)
              {
                return (target[prop] = target.get[prop]);
              },
            });
          },
        },
        {
          get(target, prop, proxy) {
            return prop in target ? target[prop] : (target[prop] = target.get[prop]);
          }
        }),
        MINE = 9,
        OPEN = 16,
        SHOW = 32,
        FLAG = 64,
        TYPE = OPEN - 1,
        WIN = 1,
        LOOSE = 2,
        OFFSET = [-1,-1,0,-1,1,-1,1,0,1,1,0,1,-1,1,-1,0], //offset around current coordinate
        BORDERS = ["top", "right", "bottom", "left"],
        anim = {
          clock: [],
          blink: 0,
          shake: 0,
          shakeEl: document.body,
          shakeFrame: 50,
          index: -1,
        },

        tableBox = EL.table.parentNode.parentNode.parentNode,
        settings = new Proxy(
        {
          width: {default: 10, value: 10, min: 2, max: 300},
          height: {default: 10, value: 10, min: 2, max: 300},
          mines: {default: 15, value: 15, min: 1, max: 9998},
          zoom: {default: 5, value: 5, min: 1, max: 30},
          click: {default: true, value: true},
          openFirst: {default: 18, value: 18}, //pre-open empty section before the game if difficulty less than this
          darkMode: {default: 0, value: 0, min: 0, max: 2},
          table: {default: [], value: []},
          animation: {default: 6, value: 6, min: 0, max: 10, onChange: val => animation({animation:val}), map:["None"]},
          monochrome: {default: false, value: false},
          audio: {default: true, value: true},
          stats: {
            start: 0,
            started: 0,
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
              return () => this.save(target);
            
            if (prop == "reset")
              return () => this.reset(target);

              if (prop == "toJSON")
              {
                const ret = {};
                for(let i in target)
                  ret[i] = target[i].value === undefined ? target[i] : target[i].value;
  
                return () => ret;
              }
  
            if (["min", "max", "default", "map"].includes(prop))
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
          }, //get()
  
          set(target, prop, value, proxy)
          {
            value = this.check(target, prop, value);
  
            if (value === undefined)
              return;
  
            target[prop].value = value;
            if (target[prop].onChange instanceof Function)
              target[prop].onChange(value);
  
            return this.save(target);
          }, //set()
  
          init(target, data)
          {
            if (data === undefined)
              data = this.load(target);
  
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
                value = target[i].default;
  
              if (value === undefined)
                continue;

              if (obj)
                target[i] = value;
              else
              {
                target[i].value = value;
                if (target[i].onChange instanceof Function)
                  target[i].onChange(value);
              }
            }
            return target;
          }, //init()
  
          load(target)
          {
            return JSON.parse(localStorage.getItem("mineSettings")) || {};
          },
  
          reset(target)
          {
            localStorage.removeItem("mineSettings");
            this.init(target);
          },
          save(target)
          {
            return localStorage.setItem("mineSettings",  JSON.stringify(Object.keys(target).reduce((obj, key) =>
            {
              let val = target[key].value;
              if (key == "table")
              {
                val = encode(val);
              }
  // for(let i = 0; i < 256; i++)
  // {
  //   console.log(i.toString(16), JSON.stringify(String.fromCharCode(i)))
  // }
              if (val === undefined)
                val = target[key];
  
              obj[key] = val;
              return obj;
            }, {})));
          }, //save()
  
          check(target, prop, value)
          {
            let res = prop in target && target[prop] !== null && (typeof target[prop].value == typeof value || typeof target[prop] == typeof value);
            if (res && target[prop] instanceof Object && target[prop] !== null && "min" in target[prop] && value < target[prop].min)
              return target[prop].min;
  
            if (res && target[prop] instanceof Object && target[prop] !== null && "max" in target[prop] && value > target[prop].max)
              return target[prop].max;
  
            return res ? value : undefined;
          }
        }), //settings
        // animation = (() =>
        // {
        //   const array = [];
        //   let timer = 0,
        //       prevCell = document.createElement("div"),
        //       perf = 0,
        //       fps = [0];
      
        //   const loop = timestamp =>
        //   {
        //     requestAnimationFrame(loop);
        //     if (timestamp - timer < 30)
        //       return;
            
        //     for (let i = 0; i < 6; i++)
        //     {
        //       if (!array.length)
        //       {
        //         prevCell.classList.remove("active");
        //         return;
        //       }
        //       timer = timestamp;
        //       const [elCell, type] = array.shift();
        //       elCell.dataset.type = type;
        //       elCell.classList.add("shown");
        //       prevCell.classList.remove("active");
        //       prevCell = elCell;
        //       prevCell.classList.add("active");
        //     }
        //   };
        //   loop();
        //   return (el, type) =>
        //   {
        //     if (el === undefined)
        //       return (array.length = 0);

        //     array[array.length] = [el, type];
        //   };
        // })(); //animation()
        animation = (() =>
        {
          //using worker so the animation continues in the background
          const worker = new Worker(URL.createObjectURL(new Blob(["let settings = {animation:" + settings.animation + "};(" + (() =>
          {
            const array = [];
            this.addEventListener("message", e =>
            {
              if (e.data === undefined)
              {
                this.postMessage({array, last:true});
                return (array.length = 0);
              }
              const data = e.data instanceof Object ? e.data : {index: e.data};
              for(let i in data)
              {
                switch(i)
                {
                  case "index":
                    array[array.length] = data[i];
                    break;
                  case "animation":
                    settings.animation = data[i];
                    break;
                }
              }
            });
            let timer = 0,
                prevRet;
          
            const loop = timestamp =>
            {
              const speed = settings.animation;
              requestAnimationFrame(loop);
              if (speed && timestamp - timer < 10-speed)
                return;

              const ret = {array: [], last: false};
              for (let i = 0, steps = speed ? speed : array.length; i < steps; i++)
              {
                if (!array.length)
                  break;
          
                ret.array[ret.array.length] = array.shift();
              }
              timer = timestamp;
              if (prevRet === ""+ret.array)
                return;
          
              this.postMessage(ret);
              prevRet = "" + ret.array;
            };
            loop();
          }).toString() + ")()"], { type: "text/javascript" })));
          let prevCell = document.createElement("div");
          worker.addEventListener("message", e =>
          {
            if (!settings.stats.started)
              return;

            const {array, last} = e.data;
            for(let i = 0; i < array.length; i++)
            {
              const elCell = showCell(array[i]);
              prevCell.classList.remove("active");
              prevCell = elCell;
              prevCell.classList.add("active");
            }
            if (!array.length || last)
              prevCell.classList.remove("active");
          });
          return (data) =>
          {
            worker.postMessage(data);
          };

        })(), //animation
        audio = (()=>
        {
          const list = window.mineTemp.audio;
          let prev;
          return (id) =>
          {
            console.log(id);
            if (!settings.audio || !list[id])
              return;

            prev && prev.pause();
            list[id].currentTime = 0;
            list[id].play().catch(er => console.error(id, er));
          };
        })();

  delete window.mineTemp;
  let timerTimeout,
      dragScroll = false,
      gameStatus = 0,
      board,
      perfect = 0;

  settings.init();
  setZoom();
  setTheme();
  setOptions();
  EL.resetSettings.addEventListener("click", e =>
  {
    settings.reset();
    setOptions();
    setZoom();
    init(true);
  });

  function setOptions(opts)
  {
    if (opts === undefined)
    {
      opts = settings.toJSON();
    }

    for(let id in opts)
    {
      const el = EL[id],
            val = opts[id];

      document.body.dataset[id] = ~~val;
      if (!el || !el.matches("input,select"))
        continue;

      if (!el.___inited)
      {
        elInit(el);
      }
      if (el.type == "checkbox")
      {
        el.checked = val;
      }
      else
        el.value = opts[id];



    }
  }
  function elInit(el)
  {
    if (el.___inited)
      return;

    el.___inited = true;
    if (el.type == "checkbox")
    {
      el.checked = settings[el.id];
    }
    else if (el.tagName == "SELECT")
    {
      let option = document.createElement("option");
      for(let i = settings.min[el.id],  def = settings.default[el.id], map = settings.map[el.id]||[]; i <= settings.max[el.id]; i++)
      {
        option = option.cloneNode(true);
        option.textContent = map[i] === undefined ? i : map[i];
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
    let timerInput, timerFilter;
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
      const opts = {};
      opts[el.id] = value;
      setOptions(opts);
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
      clearTimeout(timerInput);
      if (el.id != "animation")
        timerInput = setTimeout(() => init(true), isSelect ? 0 : 300);
  
    });
  }
  
  {
    let scaling = false,
        timerZoom,
        clientX = 0,
        clientY = 0,
        mouseDown = null;
  
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
      let zoom = settings.zoom;
      // EL.difficulty.textContent = [settings.zoom, settings.min.zoom, settings.max.zoom];
  
      if (Math.abs(dist - scaling) > 10)
      {
        zoom += dist - scaling > 0 ? 1 : -1;
        if (zoom < settings.min.zoom)
          zoom = settings.min.zoom;
  
        if (zoom > settings.max.zoom)
          zoom = settings.max.zoom;
  
        scaling = dist;
        settings.zoom = zoom;
        timerZoom = setTimeout(setZoom, 10);
      }
  
    },{passive: false});
  
    window.addEventListener("touchend", e =>
    {
      if (!scaling)
        return;
  
      scaling = false;
    });
  
    function isParent(el, selector)
    {
      if (!el || !el.matches)
        return false;
  
      return el.matches(selector) || isParent(el.parentNode, selector);
    }
    window.addEventListener("wheel", e =>
    {
      if (!isParent(e.target, "#table,#tableCanvas") || e.ctrlKey)
        return;
  
      e.preventDefault();
      e.stopPropagation();
  
      let zoom = settings.zoom;
      // EL.difficulty.textContent = [settings.zoom, settings.min.zoom, settings.max.zoom];
  
      zoom += e.deltaY < 0 ? 1 : -1;
      if (zoom < settings.min.zoom)
        zoom = settings.min.zoom;
  
      if (zoom > settings.max.zoom)
        zoom = settings.max.zoom;
  
      settings.zoom = zoom;
      timerZoom = setTimeout(setZoom, 10);
  
    },{passive: false});
  
  
    function onMouseMove (e)
    {
      if ((dragScroll && e.clientX == clientX && e.clientY == clientY)
            || (!dragScroll && Math.hypot(e.clientX - clientX, e.clientY - clientY) < 8)) //allow 6px movement
        return;
  
      clearTimeout(timerTimeout);
      document.body.classList.add("drag");
      if (!dragScroll)
      {
        // ({clientX, clientY} = e);
      }
  
      document.body.classList.add("dragging");
      tableBox.scrollBy(clientX - e.clientX, clientY - e.clientY);
      dragScroll = true;
      // mouseDown.preventDefault();
      // mouseDown.stopPropagation();
      ({clientX, clientY} = e);
  
    }
    function onMouseUp(e)
    {
      clearTimeout(timerTimeout);
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
  
    }
  
    EL.table.addEventListener("mousedown", e =>
    {
      // if (!e.button)
      //   return;

      timerTimeout = setTimeout(() =>
      {
        document.body.classList.add("drag");
        dragScroll = true;
      }, 3000);
      mouseDown = e;
      dragScroll = false;
      ({clientX, clientY} = e);
      e.preventDefault();
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
  
  
  
  window.addEventListener("DOMContentLoaded", e =>
  {
    board = canvas().init();
    console.log(board);
    // board && board.draw();
    init(!settings.table.length);
  });
  
  
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
      settings.stats.started = 1;
    }
    else
    {
      if (settings.stats.pauseTime )
      {
        settings.stats.start = new Date().getTime() - settings.stats.pauseTime  + settings.stats.pauseStart ;
      }
  
      settings.stats.pauseTime  = 0;
    }
    if (settings.pauseTime || settings.stats.start)
      settings.stats.started = 1;
    settings.save();
  }
  
  function setZoom(z)
  {
    if (z === undefined)
      z = settings.zoom;
    document.body.style.setProperty("--zoom", ((z/7*z/7) + 1) +"em");
    board && board.update();
  
  }
  function onClick(e)
  {
    e.preventDefault();
  
    if (gameStatus || dragScroll || e.target === EL.table || (e.type == "auxclick" && e.button == 2))
      return;
  
    const index = Array.from(EL.table.children).indexOf(e.target),
          leftClick = settings.click ? e.type == "click" : e.type != "click";
  
    let val = settings.table[index];
    if ((leftClick && (val & OPEN || val & FLAG || val & SHOW)) || (!leftClick && val & OPEN))
      return;
  
    settings.stats.steps[settings.stats.steps.length] = (index << 1) | !leftClick; //set bit1 = flag
  
    if (!settings.stats.start)
      timer();
  
    if (leftClick)
    {
      audio("dig");
      openCell(index);
      if ((val & TYPE) == MINE)
      {
        settings.stats.time = new Date().getTime() - settings.stats.start;
        audio("explode");
        return finished();
      }
    }
    else
    {
      settings.table[index] ^= FLAG;
      audio("flag" + (settings.table[index] & FLAG ? "" : "off"));

      e.target.dataset.type = FLAG;
      settings.stats.mines += val & FLAG ? -1 : 1;
    }
  
    if (!(settings.table[index] & OPEN + FLAG))
      delete e.target.dataset.type;
  
    if (isWon())
    {
      settings.stats.time = new Date().getTime() - settings.stats.start;
      console.log(perfect, settings.stats);
      audio(settings.stats.steps.length == perfect ? "perfect" : "win");
      finished(true);
    }
    else
    {
      board && board.update();
    }
  
    settings.save();
    //  e.target.textContent = val;
  }
  
  function finished(won)
  {
    settings.stats.start = 0;
    animation();
    document.body.classList.add("finished");
    if (won)
    {
      console.log("you win!");
      document.body.classList.add("won");
      gameStatus = WIN;
  
    }
    else
    {
      console.log("game over");
      gameStatus = LOOSE;
    }
    let steps = settings.stats.steps.map(a => a >> 1);
    for(let i = 0; i < settings.table.length; i++)
    {
      const elCell = EL.table.children[i];
      if (settings.table[i] & OPEN+FLAG)
      {
        elCell.classList.add("opened");
      }
      else
      {
        // settings.table[i] |= SHOW;
        // elCell.classList.add("shown");
      }
      const type = settings.table[i] & TYPE;
      if (type == MINE)
      {
        settings.table[i] |= SHOW;
        elCell.classList.add("shown");
        elCell.dataset.type = type;
      }
      // animation(elCell, type);
      if (settings.table[i] & FLAG)
        elCell.classList.add("flag");
  
      const pos = steps.reduce((a, v, n) =>
      {
        if (v == i)
          a[a.length] = n + 1;
    
          return a;
      }, []);
      if (pos.length)
      {
        elCell.dataset.step = pos;
        elCell.title = "Step" + (pos.length > 1 ? "s" : "") + ": " + pos.join(", ");
      }
      const borders = getBorders(i);
  
      for(let b = 0; b < borders.length; b++)
        elCell.classList.toggle(BORDERS[b], Boolean(borders[b]));
  
    
    }
    anim.index = settings.stats.steps[settings.stats.steps.length - 1]>>1;
    EL.table.children[anim.index].classList.add("last");
    anim.shakeEl = EL.table.children[anim.index];//EL.table.querySelector('*[data-type="9"].shown.last:not(.flag).last');
    settings.save(); //save settings
    board && board.update();
  }//finished();
  
  function isFinished()
  {
    let good = 0,
        result = 0;
  
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
        result = LOOSE;
    }
    return good == settings.table.length ? WIN : result;
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

  function setText(el, text)
  {
    el.textContent = text;
    el.dataset.ghost = "".padEnd((""+text).length, 8);
  }

  function timer(timestamp)
  {
    if (timestamp === undefined)
    {
      settings.stats.start = new Date().getTime();
      settings.stats.started = 1;
    }
  
    if (timestamp - settings.stats.timestamp > 15)
    {
      settings.stats.timestamp = timestamp;
      if (settings.stats.start)
        settings.stats.time = new Date().getTime() - settings.stats.start;
  
      let time = getTimeData(settings.stats.time).string;//.split(/[:.]/);
      for(let i = 0, val; i < EL.clock.children.length; i++)
      {
        val = time[EL.clock.children[i].dataset.time];
        if (anim.clock[i] != val)
        {
          anim.clock[i] = val;
          setText(EL.clock.children[i], val);
        }
      }
      setText(EL.minesFound, settings.stats.mines);
      setText(EL.minesPercent, Math.round(settings.stats.mines * 100 / settings.mines));
      setText(EL.steps, settings.stats.steps.length);
      EL.clock.classList.toggle("blink", time.ms > 500);
    }
    if (gameStatus == LOOSE && (!anim.shake || timestamp - anim.shake > anim.shakeFrame))
    {
      anim.shake = timestamp;
      anim.shakeFrame = ~~(Math.random() * 30 + 20);
      const shake = 5;
      anim.shakeEl.style.setProperty("--shakeX", ~~(Math.random() * shake * 2 -shake) / 60 + "em");
      anim.shakeEl.style.setProperty("--shakeY", ~~(Math.random() * shake * 2 -shake) / 60 + "em");
      anim.shakeEl.style.setProperty("--shakeR", ~~(Math.random() * shake * 2 -shake)  + "deg");
      if (board)
        board.shakeCell(anim.index);
    }
    // if (timestamp - anim.timers.blink > 1000)
    // {
    //   anim.timers.blink = timestamp;
    //   anim.blink = settings.stats.start && !anim.blink;
    //   EL.clock.classList.toggle("blink", anim.blink);
    // }
    requestAnimationFrame(timer);
  }
  
  function getTime(time)
  {
    const t = getTimeData(time);
    return (t.d ? t.d+"d":"") +
            (""+t.h).padStart(2,0) + ":" + 
            (""+t.m).padStart(2,0) + ":" + 
            (""+t.s).padStart(2,0) + "." + 
            (""+t.ms).padStart(3,0);
  }
  
  function getTimeData(time, string)
  {
    let sec = ~~(time / 1000);
    const ms = time % 1000,
          s = sec % 60,
          secm = (sec - s) / 60,
          m = secm % 60,
          h = ((secm - m) / 60) % 24,
          d = ~~(time / 86400000);
    return {d,h,m,s,ms, string:{
      d: d ? d + "d": "",
      h: (""+h).padStart(2,0),
      m: (""+m).padStart(2,0),
      s: (""+s).padStart(2,0),
      ms: (""+ms).padStart(3,0)
    }};
  }
  
  // function getTime(time)
  // {
  //   return time > 8553599999 ? "99:59:59.999" : new Date(time).toISOString().replace(/(\d+)T(\d+)/, (a,b,c) => (~~b-1? ("0"+Math.min(((~~b-1)*24+~~c), 99)).substr(-2) : c)).substring(8, 20);
  // }
  
  function getBorders(index) //set borders around same type of cells
  {
    const item = settings.table[index],
          borders = [],
          isOpen = ~~Boolean(item & OPEN),
          isFlag = ~~Boolean(item & FLAG),
          isShow = ~~Boolean(item & SHOW),
          value = item & TYPE,
          neighbors = [
            getIndexOffset(index, 0, -1), /*top*/
            getIndexOffset(index, 1, 0), /*right*/
            getIndexOffset(index, 0, 1), /*bottom*/
            getIndexOffset(index, -1, 0) /*left*/
          ];
  // const deb2 = {i:index, v:value};
  // deb2["|" + (item < 0 ? "------" : (isFlag?"f":"-") + (isShow?"s":"-") + (isOpen?"o":"-") + value.toString(2).padStart(Math.log2(TYPE)+1,0))] = item < 0 ? -1 : item;
  // console.log(deb2);
    for(let i = 0; i < neighbors.length; i++)
    {
      const nItem = settings.table[neighbors[i]] === undefined ? -(FLAG << 1) : settings.table[neighbors[i]],
            nOpen = ~~Boolean(nItem & OPEN),
            nFlag = ~~Boolean(nItem & FLAG),
            nShow = ~~Boolean(nItem & SHOW),
            nValue = nItem & TYPE;
  // const deb = {};
  // deb[["T","R","B","L"][i]] = nItem < 0 ? -1 : nValue;
  // deb["|" + (nItem < 0 ? "------" : (nFlag?"f":"-") + (nShow?"s":"-") + (nOpen?"o":"-") + nValue.toString(2).padStart(Math.log2(TYPE)+1,0))] = nItem < 0 ? -1 : nItem;
  // console.log(Object.assign(deb, {r:""+[
  //         (nValue == MINE && value == MINE && (isOpen + isShow) && (nOpen + nShow)),
  //         (value != MINE && nValue != MINE && (isOpen == nOpen || isShow == nShow)),
  //         (isFlag && isFlag == nFlag),
  
  //         nValue == MINE, value == MINE, (isOpen + isShow), (nOpen + nShow)
  // ]}));
      borders[i] = !(nItem >= 0 && ((value == MINE && value == nValue && (isOpen + isShow) && (nOpen + nShow)) || (value != MINE && nValue != MINE && (isOpen == nOpen || isShow == nShow)) || (isFlag && isFlag == nFlag)));
    }
  // console.log(borders)
    return borders;
  
  }

  function showCell(index)
  {
    const elCell = EL.table.children[index];

    elCell.dataset.type = settings.table[index] & TYPE;
    elCell.classList.add("shown");
    return elCell;
  }
  function openCell(index, table, animate = true)
  {
    const array = [index],
          ret = {};

    let show = false;
    if (!table)
    {
      show = true;
      table = settings.table;
    }
    while(array.length)
    {
      index = array.shift();
      if (table[index] === undefined)
        break;

      if (table[index] & OPEN)
        continue;

      if (show)
      {

        if (animate)
          animation(index);
        else
          showCell(index);
      // const borders = getBorders(index);
      // for(let b = 0; b < borders.length; b++)
      //   elCell.classList.toggle(BORDERS[b], Boolean(borders[b]));

        if (!(table[index] & OPEN))
          settings.stats.open++;

      }
      table[index] |= OPEN;
      ret[index] = table[index];

      if (table[index] == OPEN)
      {
        let offset = [];
        // OFFSET.push(OFFSET.shift(), OFFSET.shift());
        for(let o = 0; o < OFFSET.length; o+=2)
        {
          offset[o/2] = [OFFSET[o], OFFSET[o+1]];
        }
        // offset.sort( () => .5 - Math.random() );
        for(let o = 0; o < offset.length; o++)
        {
          const i = getIndexOffset(index, offset[o][0], offset[o][1]),
                val = table[i];

          if (!(val === undefined || val == MINE || val & FLAG || table[i] & OPEN))
          {
            array.push(i);
          }
            // ret = (() => openCell(i, table, show, ret))();
        }
      }
    }
    // if (show)
    //   settings.table = table;

    return ret;
  }
  // function openCell_(index, table)
  // {
  //   let array = [index],
  //       ret = {},
  //       show = false;
  
  //   if (!table)
  //   {
  //     show = true;
  //     table = Object.assign([], settings.table);
  //   }
  
  //   while(array.length)
  //   {
  //     index = array.pop();
  //     if (show)
  //     {
  //       const elCell = EL.table.children[index];
  //       elCell.dataset.type = table[index] & TYPE;
  //       elCell.classList.add("shown");
  //     // const borders = getBorders(index);
  //     // for(let b = 0; b < borders.length; b++)
  //     //   elCell.classList.toggle(BORDERS[b], Boolean(borders[b]));
  
  //       if (!(table[index] & OPEN))
  //         settings.stats.open++;
  
  //     }
  //     table[index] |= OPEN;
  //     ret[index] = table[index];
  //     if (table[index] != OPEN)
  //       continue;
  
  //     for(let o = 0; o < OFFSET.length; o+=2)
  //     {
  //       let i = getIndexOffset(index, OFFSET[o], OFFSET[o+1]),
  //           val = table[i]; //right
  
  //       if (val === undefined || val == MINE || val & FLAG)
  //         continue;
  
  //       if (val === 0)
  //       {
  //         array[array.length] = i;
  //         continue;
  //       }
        
  //       if (!(val & OPEN))
  //       {
  //         if (show)
  //         {
  //           if (val)
  //             EL.table.children[i].dataset.type = val;
  
  //           if (!(settings.table[i] & OPEN))
  //             settings.stats.open++;
  //             EL.table.children[i].classList.add("shown");
  //         }
  //         table[i] |= OPEN;
  //       }
  //       ret[i] = table[i];
  //     }
  //   }
  //   if (show)
  //     settings.table = table;
  
  //   return ret;
  
  // }
  
  function rand(min, max)
  {
    return Math.round(Math.random() * (max - min) + min);
  }
  
  function init(reset = false)
  {
    settings.stats.started = 0;
    animation();
    gameStatus = 0;
    EL.table.className = "";
    document.body.classList.remove("finished");
    document.body.classList.remove("won");
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
      const max = Math.min(settings.mines, settings.table.length - 1);
      let mines = 0;
  
      while(mines < max)
      {
        const mine = rand(0, settings.table.length-1);
        if (!settings.table[mine])
        {
          mines++;
          settings.table[mine] = MINE;
        }
      }
    }
    while(EL.table.children.length > settings.table.length)
      EL.table.removeChild(EL.table.lastChild);
  
    let started = false,
        flags = 0,
        mines = 0,
        perfectSteps = [],
        perfectList = {},
        table = [];

    perfect = 0;
    for(let i = 0, OPENED = OPEN + SHOW; i < settings.table.length; i++)
    {
      const elCell = EL.table.children[i] || document.createElement("span"),
            item = settings.table[i];
  
      let itemType = item & TYPE;
  
      if (!elCell.parentNode)
        EL.table.appendChild(elCell);
  
      elCell.className = "";
      elCell.removeAttribute("style");
      for(let i in elCell.dataset)
        delete elCell.dataset[i];

      elCell.title = "";
      if (reset)
      {
        let minesNum = 0;
        if (item != MINE)
        {
          for(let o = 0; o < OFFSET.length; o+=2)
          {
            let index = getIndexOffset(i, OFFSET[o], OFFSET[o+1]); //right
    // console.log(i, index, mines);
            if (settings.table[index] == MINE)
              minesNum++;
          }
          settings.table[i] = itemType = minesNum;
        }
        // elCell.textContent = table[i];
        // for(let i in elCell.dataset)
        //   delete elCell.dataset[i];
  
  //      elCell.className = "";
      }
      else
      {
        if (item & OPENED)
        {
          elCell.classList.add("shown");
          elCell.dataset.type = item & TYPE;
          // animation(elCell, item & TYPE);
          started = true;
        }
        if(item & FLAG)
        {
          elCell.dataset.type = FLAG;
          flags++;
          started = true;
        }
      }
      if ((settings.table[i] & TYPE) == MINE)
        mines++;
  
      table[table.length] = itemType;
    }//for settings.table
    const _table = Object.assign([], table);
    for(let i = 0; i < settings.table.length; i++)
    {
      if (perfectList[i] !== undefined || (settings.table[i] & TYPE) != 0)
        continue;
  
      Object.assign(perfectList, openCell(i, _table));
      perfect++;
      perfectSteps[perfectSteps.length] = i;
    }
  // console.log(table);
  
  // console.log(settings.table);
  // console.log(perfectSteps);
  // console.log(perfectList);
    for(let i = 0; i < settings.table.length; i++)
    {
      if (perfectList[i] === undefined && (settings.table[i] & TYPE) != MINE)
      {
        perfect++;
        perfectList[i] = settings.table[i];
        perfectSteps[perfectSteps.length] = i;
      }
    }
    // console.log(perfectList);
  
    if (started && difficulty() > settings.openFirst)
    {
      perfect--;
    }
  // console.log(perfect, mines, perfectSteps);
    // if (flags !== settings.stats.mines)
    // {
    //   settings.stats.mines = flags;
    // }
    document.body.style.setProperty("--cols", settings.width);
    document.body.style.setProperty("--rows", settings.height);
    // for(let i = 0; i < settings.height; i++)
    //   console.log(settings.table.slice(i * settings.width, i * settings.width + settings.width));
    
    setText(EL.minesTotal, settings.mines);

    settings.save(); //save settings
    timer(0);
    const finish = isFinished();
    if (finish)
      finished(finish == WIN);
  
    EL.difficulty.textContent = ["Can't loose", "Don't wanna think", "Super easy", "Easy", "Normal", "Medium", "Hard", "Very hard", "I can do this!", "I'll try it anyway", "Impossible", "Gotta buy a lottery"][Math.min(~~(difficulty() * 3 / 11), 11)];// + " [" + ~~(difficulty()) + "%]";
    EL.difficulty.dataset.value = ~~(difficulty() + 1);
  
    if (!started && difficulty() > settings.openFirst)
    {
      let empty = [];
      for(let i = 0; i < settings.table.length; i++)
      {
        if (!settings.table[i])
          empty[empty.length] = i;
      }
      // empty.forEach(e => {
      //   if (!(settings.table[e] & OPEN))
      //   {
      //     openCell(e);
      //     perfect--;
      //   }
      // });

      if (empty.length)
      {
        perfect--;
        openCell(empty[~~(rand(0, empty.length-1))], undefined, false);
      }
  
    }
    perfect += mines;
    setText(EL.perfect, perfect);
    board && board.update();
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
  
  
  
  function setTheme(theme)
  {
    if (theme === undefined)
      theme = settings.darkMode;
  
    if (theme == 2)
      document.documentElement.removeAttribute("theme");
    else
      document.documentElement.setAttribute("theme", settings.darkMode ? "dark" : "light");
  
    settings.darkMode = theme;
    const style = document.getElementById("dropdownstyle") || document.createElement("style"),
          s = getComputedStyle(document.querySelector("select")),
          css = `label.dropdown{${Array.from(s).map(k =>`${k}:${s[k]}`).join(";")}}`;
  
    style.innerHTML = css;
    style.id = "dropdownstyle";
    document.head.insertBefore(style, document.head.querySelector("[rel='stylesheet']"));
    document.documentElement.style.setProperty("--textColor", getComputedStyle(document.documentElement).color);
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
  
      r[r.length] = v.toString(36);
    }
    return r.join("\xad");//separate text with "invisible" character
  }
  
  function decode(val)
  {
    val = val.split("\xad");
    let r = [],
        bits = Math.log2(FLAG) + 1,
        max = ~~(32 / bits),
        mask = (FLAG << 1) - 1;
  
    for(let i = 0; i < val.length; i++)
    {
      let id = (i+1) * max;
      for(let n = 0; n < max; n++)
        r[id-n-1] = parseInt(val[i], 36) >> n*bits & mask;
    }
    return r;
  }
  function canvas()
  {
    return class canvas
    {
      constructor()
      {
        this.canvas = EL.tableCanvas;
        this.ctx = this.canvas.getContext("2d");
        this.mouse = {
          xw: 0, //world position
          yw: 0,
          xs: 0, //screen position
          ys: 0,
          button: 0
        };
        this.pos = {
          xw: 0, //world position
          yw: 0,
          xs: 0, //screen position
          ys: 0,
        };
        const style = getComputedStyle(this.canvas);
        this.cellSize = parseFloat(style.fontSize);
        this.offset = this.cellSize / 2.74075;
        this.textSize = this.cellSize - this.offset + 0.5;
        this.textSizeSmall = this.textSize / 3.5;
        this.shadowSize = this.cellSize / 10;
        this.ctx.width = settings.width * this.cellSize + this.shadowSize*2;
        this.ctx.height = settings.height * this.cellSize + this.shadowSize*2;
        this.canvas.width = this.ctx.width;
        this.canvas.height = this.ctx.height;
        this.images = {};
        this.style = {};
        this.loadImages();
        this.loadColors();
  console.log(this.cellSize, this.ctx.font, style.font);
        this.update();
      }
  
      update()
      {
        const style = getComputedStyle(this.canvas);
        this.cellSize = parseFloat(style.fontSize);
        this.offset = this.cellSize / 2.74075;
        this.textSize = this.cellSize - this.offset + 0.5;
        this.textSizeSmall = this.textSize / 3.5;
        this.shadowSize = this.cellSize / 10;
        this.ctx.width = settings.width * this.cellSize + this.shadowSize*2;
        this.ctx.height = settings.height * this.cellSize + this.shadowSize*2;
        this.canvas.width = this.ctx.width;
        this.canvas.height = this.ctx.height;
        this.font = "bold " + this.textSize + "px " + this.style.font;
        this.fontSmall = this.textSizeSmall + "px " + this.style.font;
        this.ctx.font = this.font;
        this.ctx.textBaseline = "middle";
        this.ctx.textAlign = "center";
        this.ctx.clearRect(0, 0, this.ctx.width, this.ctx.height);
        this.tableSorted = {
          draw: [],
          visible: [],
          reg: [],
          mines: [],
          flags: [],
        };
        this.loadSteps();
        this.tableUpdate();
        this.isFinished = isFinished();
  console.log(this.isFinished);
        this.draw();
      }
      fitString (str, w)
      {
        const width = this.ctx.measureText(str).width,
              ellipsis = '…',
              ellipsisWidth = this.ctx.measureText(ellipsis).width;
  
        if (width <= w || width <= ellipsisWidth)
          return str;
  
        let min = 0,
            index = str.length,
            getValue = guess => this.ctx.measureText(str.substring(0, guess)).width,
            match = w - ellipsisWidth;
  
        while (min <= index)
        {
          const guess = Math.floor((min + index) / 2),
                compareVal = getValue(guess);
  
          if (compareVal === match) return guess;
          if (compareVal < match) min = guess + 1;
          else index = guess - 1;
        }
  
        return str.substring(0, index) + ellipsis;
      }
  
      tableUpdate()
      {
        this.tableSorted.draw.length = 0;
        this.tableSorted.visible.length = 0;
        this.tableSorted.reg.length = 0;
        this.tableSorted.mines.length = 0;
        this.tableSorted.flags.length = 0;
        const mines = [],
              flags = [],
              reg = [],
              visible = [];
  
        for(let i = 0, value, type; i < settings.table.length; i++)
        {
          value = settings.table[i];
          type = settings.table[i] & TYPE;
          if (value & FLAG)
            flags[flags.length] = i;
          else if (type == MINE && (value & SHOW || value & OPEN))
            mines[mines.length] = i;
          else
            reg[reg.length] = i;
  
        }
        mines.reverse();
        const mine = mines.indexOf(settings.table.indexOf(MINE + OPEN));
        mines.splice(0, 0, mines.splice(mine, 1)[0]);
        this.savedCell = null;
        this.tableSorted.draw = this.tableSorted.draw.concat(mines, reg, flags);
        this.tableSorted.reg =  this.tableSorted.reg.concat(reg);
        this.tableSorted.visible = this.tableSorted.visible.concat(visible);
        this.tableSorted.flags = this.tableSorted.flags.concat(flags);
        this.tableSorted.mines = this.tableSorted.mines.concat(mines);
      }
  
      loadImages(type)
      {
        const imgs = {
          flag: EL.imgFlag,
          mine: EL.imgMine
        };
        for(let i in imgs)
        {
          const url = getComputedStyle(imgs[i]).backgroundImage.slice(4, -1).replace(/"/g, "");
          this.images[i] = new Promise((resolve, reject) =>
          {
            const img = new Image();
            console.log(url);
            img.onload = e => resolve(img);
            img.onerror = reject;
            img.src = url;
          });
        }
      }
  
      loadColors()
      {
        const vars = ["stroke", "fill", "flag", "mineGood", "mineBad", "open", "openGood", "openBad", "font"],
              style = getComputedStyle(document.body);
  
        for(let i = 0; i < vars.length; i++)
          this.style[vars[i]] = style.getPropertyValue("--cell-" + vars[i]);
  console.log(this.style);
      }
  
      static init()
      {
        return EL.tableCanvas ? new this() : null;
      }
  
      draw()
      {
        for(let i = 0; i < this.tableSorted.draw.length; i++)
        {
          this.drawCell(this.tableSorted.draw[i]);
        }
        if (this.isFinished == LOOSE)
        {
          this.drawCell(this.tableSorted.draw[0], 0, 1);
        }
      }
  
      loadSteps()
      {
        this.steps = settings.stats.steps.map(a => a >> 1);
      }
  
      shakeCell(index)
      {
        let list = [index],
              reg = [],
              mines = [],
              flags = [];
  
        // for(let o = 0, value, type; o < OFFSET.length; o+=2)
        // {
        //   const i = getIndexOffset(index, OFFSET[o], OFFSET[o+1]);
  
        //   value = settings.table[i];
        //   type = settings.table[i] & TYPE;
        //   if (value & FLAG)
        //     flags[flags.length] = i;
        //   else if (type == MINE && (value & SHOW || value & OPEN))
        //     mines[mines.length] = i;
        //   else
        //     reg[reg.length] = i;
        // }
        // list = list.concat(mines, reg, flags);
        for(let i = 0; i < list.length; i++)
        {
          if (list[i] > -1) this.drawCell(list[i], !i);
        }
      
      }
  
      
      drawCell(index, shake = false, save = false, ctx = this.ctx)
      {
        if (shake && !this.savedCell)
          return;
  
        const cell = this.cell(index);
        let {x, y, type, status} = cell,
            size = this.cellSize;
  
        if (cell.isFlag)
        {
          x -= 1;
          y -= 1;
            size += 1;
        }
        x++;
        y++;
        ctx.strokeStyle = this.style.stroke;
        ctx.fillStyle = cell.isOpen ? this.style.open : this.style.fill;
        if (this.isFinished)
        {
          ctx.fillStyle = cell.isShow ? this.style.openBad : this.isFinished == WIN ? this.style.openGood : this.style.open;
          let p = -1;
          while ((p = this.steps.indexOf(index, p+1)) > -1)
            cell.step[cell.step.length] = p + 1;
        }
  
        if (cell.isFlag)
          ctx.fillStyle = cell.isMine && this.isFinished ? this.style.mineGood : this.style.flag;
        else if (cell.isMine && this.isFinished)
        {
          ctx.fillStyle = this.style.mineBad;
        }
        if (cell.isShake && save)
        {
          this.savedCell = ctx.getImageData(x, y, size, size);
        }
        ctx.clearRect(x, y, size,size);
        ctx.save();
        if (cell.isFlag)
        {
          // x += 1;
          // y += 1;
          // size -= 1;
          ctx.shadowBlur = this.shadowSize/1.5;
          ctx.shadowOffsetY = this.shadowSize;
          ctx.shadowOffsetX = this.shadowSize;
          ctx.shadowColor = "#000";
        }
        if (cell.isShake && this.savedCell)
          ctx.putImageData(this.savedCell, x, y);
        else
          ctx.fillRect(x, y, size, size);
  
        ctx.restore();
        if (cell.isFlag && !this.isFinished)
          this.drawImg("flag", x, y, size);
        else if (cell.isMine && this.isFinished)
        {
          if (!cell.isShake || (cell.isShake && this.savedCell))
          {
            let offsetX = 0, offsetY = 0, rotate = 0;
            if (shake)
            {
              offsetX = ~~(Math.random() * size  - size /2) / 20;
              offsetY = ~~(Math.random() * size  - size /2) / 20;
              rotate = Math.random() * 10;
            }
            this.drawImg("mine", x, y, size, offsetX, offsetY, rotate);
          }
        }
        else if (cell.type && (cell.isOpen || cell.isShow))
        {
          ctx.fillStyle = this.style.stroke;
          ctx.fillText(type, x + Math.round(size/2)+0.0, y + Math.round(size /2)+~~(this.textSize / 10) - 0.5);
        }
  
        if (cell.step && !(cell.isShake && this.savedCell))
        {
          ctx.save();
          ctx.fillStyle = this.style.stroke;
          ctx.font = this.fontSmall;
          ctx.textAlign = "end";
          ctx.textBaseline = "top";
          const txt = this.fitString("" + cell.step, size-5),
                offset = this.textSizeSmall / 4;
          ctx.fillStyle = this.style.stroke;
          ctx.strokeStyle = this.style.fill;
          ctx.lineWidth = (this.textSizeSmall / 4);
          ctx.strokeText(txt, x + size-offset, y + offset);
          ctx.fillText(txt, x + size-offset, y + offset);
          ctx.restore();
        }
        ctx.strokeRect(x, y, size, size);
      }
  
      drawImg(img, x, y, size, offsetX = 0, offsetY = 0, rotate = 0)
      {
        this.images[img].then(img => 
        {
          this.ctx.save();
          this.ctx.globalCompositeOperation = "source-atop";
          this.ctx.shadowBlur = this.shadowSize/1.5;
          this.ctx.shadowColor = "#FFFFFF7F";
          const tx = x+size/2,
                ty = y+size/2;
  
          this.ctx.translate(tx,ty);
          this.ctx.rotate(rotate* Math.PI / 180);
          this.ctx.translate(-tx,-ty);
          this.ctx.drawImage(img, x+offsetX+size/9, y+offsetY+size/9, size-size/4.5, size-size/4.5);
          this.ctx.restore();
  
        }).catch(console.error);
      }
  
      cell(index)
      {
        const {x, y} = indexToXY(index),
              value = settings.table[index],
              type = value & TYPE,
              size = this.getTextBox(type);
        return {
          x: x * this.cellSize + 0.5,
          y: y * this.cellSize + 0.5,
          value,
          type: type,
          isMine: type == MINE,
          isOpen: value & OPEN,
          isFlag: value & FLAG,
          isShow: value & SHOW,
          isVis: value & (SHOW + OPEN),
          status: value & (OPEN + FLAG + SHOW),
          isShake: type == MINE && value & OPEN,
          size,
          step: []
        };
      }
  
      getTextBox(text)
      {
        text = "" + text;
        const metrics = this.ctx.measureText( text ),
              left = metrics.actualBoundingBoxLeft * -1,
              top = metrics.actualBoundingBoxAscent * -1,
              right = metrics.actualBoundingBoxRight,
              bottom = metrics.actualBoundingBoxDescent,
        // actualBoundinBox... excludes white spaces
              width = text.trim() === text ? right - left : metrics.width,
              height = bottom - top;
        return { left, top, right, bottom, width, height };
      
      }
  
      indexToXY(index)
      {
        return {x: (index % this.width), y: ~~(index / this.width)};
      }
      
      getIndexOffset(index, offsetX, offsetY)
      {
        let {x, y} = indexToXY(index);
        x += offsetX-0.5;
        y += offsetY-0.5;
        if (x < 0 || x > this.width-1 || y < 0 || y > this.height-1)
          return -1;
      
        return y * this.width + x;
      }
      
  
    };
  }
  }
  