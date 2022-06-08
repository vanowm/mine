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
        QUESTION = 128,
        MAX = QUESTION,
        TYPE = OPEN - 1,
        WIN = 1,
        LOOSE = 2,
        STATE_STOPPED = 0,
        STATE_STARTED = 1,
        STATE_PAUSED = 2,
        STATS_RESULT = 0, /* flags saved in steps, bit 1 = flag */
        STATS_TIME = 1,
        STATS_MINES = 2,
        STATS_STEPS = 3,
        STATS_PERFECT = 4,
        OFFSET = [-1,-1,0,-1,1,-1,1,0,1,1,0,1,-1,1,-1,0], //offset around current coordinate
        BORDERS = ["top", "right", "bottom", "left"],
        anim = {
          blink: 0,
          shake: 0,
          shakeEl: document.body,
          shakeFrame: 50,
          index: -1,
          explode:
          {
            el: EL['.tableBox'],
            shake: 6, //intensity
            timer: 0,
            duration: 500, //duration
          },
        },
        tableBox = EL.table.parentNode.parentNode.parentNode,
        presets = {/* [ width, height, mines ] */
          "Can't loose": [9,9,2],
          "Don't wanna think": [9,9,5],
          "Super easy": [9,9,8],
          "Easy": [16,16,29],
          "Normal": [16,16,38],
          "Medium": [30,16,88],
          "Hard": [30,16,106],
          "Very hard": [30,30,231],
          "I can do this!": [30,30,264],
          "I'll try it anyway": [30,30,297],
          "Impossible": [30,30,330],
          "Gotta buy a lottery": [30,30,363],
        },
        difficultyCheat = 18,
        SETTINGS = new Proxy(
        {
          width: {default: 16, value: 16, min: 2, max: 100, resetBoard: true},
          height: {default: 16, value: 16, min: 2, max: 100, resetBoard: true},
          mines: {default: 38, value: 38, min: 1, max: 9998, resetBoard: true},
          zoom: {default: 12, value: 12, min: 1, max: 70},
          click: {default: 0, value: 0, min: 0, max: 1, map:["Open", "Flag"]},
          openFirst: {default: false, value: false}, //pre-open empty section before the game if difficulty less than this
          darkMode: {default: 0, value: 0, min: 0, max: 2},
          table: {default: [], value: []},
          animation: {default: 10, value: 10, min: 0, max: 20, onChange: val => animations.steps(val), map:["None"]},
          monochrome: {default: false, value: false},
          audio: {default: true, value: true},
          showSteps: {default: true, value: true},
          flagRequire: {default: false, value: false, onChange: val => !gameStatus && showDigits(EL.perfect, perfect.val)},
          stats: {
            start: 0,
            started: 0,
            mines: 0,
            time: 0,
            timestamp: 0,
            open: 0,
            pauseTime: 0,
            pauseStart: 0,
            steps: [], //list of indexes, bit1 = flag
          }
        },
        {
          get(target, prop, proxy)
          {
            if (prop === "init")
              return () => this.init(target);
  
            if (prop == "save")
              return () => this.save(target);
            
            if (prop == "clear")
              return () => this.clear(target);

            if (prop == "presets")
            {
              return [target.width.value, target.height.value, target.mines.value];
            }
            if (prop == "toJSON")
            {
              const ret = {};
              for(let i in target)
                ret[i] = target[i].value === undefined ? target[i] : target[i].value;

              return () => ret;
            }
  
            if (["min", "max", "default", "map", "resetBoard"].includes(prop))
            {
              return Object.keys(target).reduce((obj, key) => 
              {
                if (key == "mines" && prop == "max")
                {
                  target[key][prop] = target.width.value * target.height.value - 2;
                }
                obj[key] = target[key][prop];
                return obj;
              }, {});
            }
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
                if (data[i].length)
                  data[i] = decode(data[i]);
                else
                  data[i] = new Array(SETTINGS.width * SETTINGS.height).fill(0);
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
  
          clear(target)
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
                if (SETTINGS.stats.started || SETTINGS.stats.time)
                  val = encode(val);
                else
                  val = [];
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

        STATS = new Proxy({},
        {
          get(target, prop, proxy)
          {
            if (target[prop] === undefined)
            {
              const {value, get} = Object.getOwnPropertyDescriptor(this, prop)||{};
              if ((get||value) instanceof Function)
              {
                if (get)
                  return get.call({handler: this, target});
                else
                  return (args) => value.call(this, target, args);

              }
              const stats = this._stats[[SETTINGS.width,SETTINGS.height,SETTINGS.mines]];
              if (stats && stats[prop] !== undefined)
                return stats[prop];

              if ((prop.constructor !== Symbol) && (""+prop).match(/[0-9]+,[0-9]+,[0-9]+/))
                target[prop] = {};
            }
            return target[prop];
          },

          set(target, prop, value, proxy)
          {
            target[prop] = value;
          },

          deleteProperty(target, prop)
          {
            delete target[prop];
          },

          init(target, data)
          {
            if (data === undefined)
              data = this.load(target);
  
            for(let i in data)
            {
              let value = data[i];

              if (value !== undefined)
                target[i] = value;
            }
            this.get(target, "stats");
            return target;
          }, //init()

          load(target)
          {
            return JSON.parse(localStorage.getItem("mineStats")) || {};
          },
  
          clear(target, board)
          {
            if (board)
            {
              delete target[board];
            }
            else
            {
              for(const i in target)
                delete target[i];
            }
            this.save(target);
            this.init(target);
            this.show(target);
          },

          save(target)
          {
            this.get(target, "stats");
            return localStorage.setItem("mineStats",  JSON.stringify(Object.keys(target).reduce((ret, key) =>
            {
              ret[key] = target[key];
              return ret;
            }, {})));
          }, //save()

          show(target, obj)
          {
            if (obj === undefined)
              obj = this._stats[[SETTINGS.width, SETTINGS.height, SETTINGS.mines]] || {};

            const isAll = obj === this._stats.all,
                  pref = "stats_" + (isAll ? "all_" : ""),
                  boardSizeText = ["x", "@", " mines"];

            for(let i in this._stats.all)
            {
              const el = EL[pref + i];
              if (!el) continue;
              let val = ~~obj[i];
              if (["time", "best", "worst"].includes(i))
              {
                showClock(el, val, true);
                el.dataset.size = obj && obj[i+"Size"] || "";
                if (el.dataset.size)
                  el.dataset.size = el.dataset.size.split(",").reduce((ret, val, i) => ret += val + boardSizeText[i], "");

                el.parentNode.lastElementChild.textContent = el.dataset.size ? "(" + el.dataset.size + ")" : "";
                continue;
              }
              showDigits(el, val);
            }
            let val = Math.round(obj.wins * 100 / obj.games) || 0;
            EL[pref + "wins"].dataset.percent = val;
            EL[pref + "wins"].parentNode.lastElementChild.textContent = "(" + val + "%" + ")";
            val = Math.round(obj.loses * 100 / obj.games) || 0;
            EL[pref + "loses"].dataset.percent = val;
            EL[pref + "loses"].parentNode.lastElementChild.textContent = "(" + val + "%" + ")";
            val = Math.round(obj.perfect * 100 / obj.wins) || 0;
            EL[pref + "perfect"].dataset.percent = val;
            EL[pref + "perfect"].parentNode.lastElementChild.textContent = "(" + val + "%" + ")";
            val = Math.round(obj.flags * 100 / obj.steps) || 0;
            EL[pref + "flags"].dataset.percent = val;
            EL[pref + "flags"].parentNode.lastElementChild.textContent = "(" + val + "%" + ")";
            val = Math.round(obj.questions * 100 / obj.steps) || 0;
            EL[pref + "questions"].dataset.percent = val;
            EL[pref + "questions"].parentNode.lastElementChild.textContent = "(" + val + "%" + ")";
            val = Math.round(obj.clicked * 100 / obj.steps) || 0;
            EL[pref + "clicked"].dataset.percent = val;
            EL[pref + "clicked"].parentNode.lastElementChild.textContent = "(" + val + "%" + ")";
            if (!isAll)
            {
              val = Math.round(obj.games * 100 / this._stats.all.games) || 0;
              EL[pref + "games"].dataset.percent = val;
              EL[pref + "games"].parentNode.lastElementChild.textContent = "(" + val + "%" + ")";
            }
            if (!isAll)
              this.show(target, this._stats.all);
          },
          _stats: {},
          get stats()
          {
            const {handler, target} = this,
                  _default = {
                    games: 0,
                    wins: 0,
                    loses: 0,
                    steps: 0,
                    clicked: 0,
                    flags: 0,
                    questions: 0,
                    best: 0,
                    worst: 0,
                    perfect: 0,
                    time: 0,
                    timeSize: "",
                    bestSize: "",
                    worstSize: ""
                  },
                  stats = {
                    all: Object.assign({}, _default),
                  };

            // handler.get(target, [SETTINGS.width, SETTINGS.height, SETTINGS.mine]);
            for(let size in target)
            {
              stats[size] = Object.assign({}, _default);
              let list = target[size],
                  data = stats[size];

              for(let date in list)
              {
                data.games++;
                const rightClicks = {},
                      game = list[date];

                data.time += game[STATS_TIME];

                for(let i = 0, steps = game[STATS_STEPS]; i < steps.length; i++)
                {
                  const index = steps[i] >> 1,
                        isRightClick = steps[i] & 1;

                  if (isRightClick)
                  {
                    rightClicks[index] = ~~rightClicks[index] + 1;
                    const isQuestion = !(2 - rightClicks[index] % 3),
                          isFlag = !((3 - rightClicks[index] % 3) % 2);

                    data.flags += isFlag ? 1 : isQuestion ? -1 : 0;
                    data.questions += isQuestion ? 1 : isFlag ? 0 : -1;
                  }
                  else
                    data.clicked++;


                }
                if (game[STATS_RESULT])
                {
                  data.wins++;
                  if (game[STATS_PERFECT] == game[STATS_STEPS].length)
                    data.perfect++;

                  if (!data.best || data.best > game[STATS_TIME])
                    data.best = game[STATS_TIME];
    
                  if (game[STATS_TIME] && data.worst < game[STATS_TIME])
                    data.worst = game[STATS_TIME];
                }
                else
                  data.loses++;

                data.steps += game[STATS_STEPS].length;
              }
              for(let i in data)
              {
                if (i == "best" || i == "worst")
                  continue;

                stats.all[i] += data[i];
              }
              if (data.best && (!stats.all.best || stats.all.best > data.best))
              {
                stats.all.best = data.best;
                stats.all.bestSize = size;
              }
              if (data.worst && stats.all.worst < data.worst)
              {
                stats.all.worst = data.worst;
                stats.all.worstSize = size;
              }
            }
            handler._stats = stats;
            return handler._stats;
          },

          list(target, value = [SETTINGS.width,SETTINGS.height,SETTINGS.mines])
          {
            return this.get(target, value);
          },

        }),//stats

        animations = (()=>
        {
          const list = new Map();
          class Animation
          {
            constructor(opt = {})
            {
              let info = list.get(this) || {
                          id: list.size,
                          date: new Date()
                        };

              list.set(this, info);
              this.worker =  new Worker(URL.createObjectURL(new Blob(["const opts = {};(" + (() =>
              {
                const array = [];
                let status = 0;

                const commands = {
                  start: () => status = 1,
                  stop: (() =>
                  {
                    status = 0;
                    this.postMessage({array, last: true});
                    return (array.length = 0);
                  }).bind(this),
                  pause: () => status = 2,
                };
                this.addEventListener("message", e =>
                {
                  const data = e.data;
                  for(let i in data)
                  {
                    switch(i)
                    {
                      case "index":
                        array[array.length] = data[i];
                        break;
                      case "opt":
                        for(let o in data[i])
                          opts[o] = data[i][o];
                        break;
                      case "command":
                        if (commands[data[i]] instanceof Function)
                          commands[data[i]](data.args);
                        break;
                    }
                  }
                });
                let timer = 0,
                    prevRet = ""+array;
              
                const loop = timestamp =>
                {
                  const {speed, steps, delay} = opts;
                  requestAnimationFrame(loop);
                  if (status != 1 || (steps && timestamp - timer < speed-steps))
                    return;

                  if (timestamp && !steps)
                    return commands.stop();

                  if (delay && !timer)
                  {
                    timer = timestamp + delay - speed - steps;
                    return;
                  }
                  const ret = {array: [], last: false};
                  for (let i = 0, max = Math.min(steps, array.length); i < max; i++)
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
              this.worker.addEventListener("message", e =>
              {
                info.date = new Date();
                this.list.set(this, info);
                if (!SETTINGS.stats.started)
                  return;
            
                const {array, last} = e.data;
                for(let i = 0; i < array.length; i++)
                {
                  const elCell = showCell(array[i]);
                  elCell.classList.add("active");
                  prevCell.classList.remove("active");
                  prevCell = elCell;
                }
                if (!array.length || last)
                {
                  prevCell.classList.remove("active");
                  this.worker.status = 0;
                  this.list.delete(this);
                  this.worker.terminate();
                }
              });
              this.worker.status = 1;
              this.steps(opt.animation === undefined ? SETTINGS.animation : opt.animation);
              this.speed(30);
              if (opt.start)
                this.start();
            }
            start()
            {
              this.worker.postMessage({command:"start"});
            }
            pause()
            {
              this.worker.postMessage({command:"pause"});
            }
            stop()
            {
              this.worker.postMessage({command:"stop"});
            }
            add(data)
            {
              this.worker.postMessage({index: data});
            }
            speed(data)
            {
              this.worker.postMessage({opt: {speed: data}});
            }
            delay(data)
            {
              this.worker.postMessage({opt: {delay: data}});
            }
            steps(data)
            {
              this.worker.postMessage({opt: {steps: data}});
            }
            get status(){ return this.worker.status;}
            get list() {return list;}
          }//class Animation

          return {
            new: (opt) => new Animation(opt),
            stop: () =>
            {
              list.forEach((info, anim) => anim.stop());
            },
            steps: (data) =>
            {
              list.forEach((info, anim) => anim.steps(data));
            },
            list
          };
        })(), //animations

        audio = (()=>
        {
          const list = window.mineTemp.audio;
          let prev;
          return (id) =>
          {
            if (!SETTINGS.audio || !list[id])
              return;

            prev && prev.pause();
            list[id].currentTime = 0;
            list[id].play().catch(er => console.error(id, er));
          };
        })(),
        showPrev = new Map();

  delete window.mineTemp;
  let timerTimeout,
      dragScroll = false,
      gameStatus = 0,
      board,
      perfect = [0,0];

  Object.defineProperty(perfect, "val",
  {
    get() {return this[~~SETTINGS.flagRequire];}
  });

  SETTINGS.init();
  STATS.init();
  setZoom();
  setTheme();
  setOptions();

  init(!SETTINGS.table.length);
  EL.resetSettings.addEventListener("click", e =>
  {
    SETTINGS.clear();
    setOptions();
    setZoom();
    init(true);
  });

  EL.all['.statsBoard .clear'].forEach(el =>
  {
    el.addEventListener("click", e =>
    {
      STATS.clear(e.target.classList.contains("board") ? [SETTINGS.width,SETTINGS.height,SETTINGS.mines] : undefined);
    });
  });
  function setOptions(opts)
  {
    if (opts === undefined)
    {
      opts = SETTINGS.toJSON();
      opts.presets = ""+[SETTINGS.width, SETTINGS.height, SETTINGS.mines];
    }

    for(let id in opts)
    {
      const el = EL[id],
            val = opts[id];

      document.body.dataset[id] = id == "presets" ? val : ~~val;
      if (!el || !el.matches("input,select"))
        continue;

      elInit(el);

    }
  }
  function elInit(el)
  {
    if (el.type == "checkbox")
    {
      el.checked = SETTINGS[el.id];
    }
    else if (el.tagName == "SELECT")
    {
      let option = document.createElement("option");
      if (el.id == "presets")
      {
        if (!el.children.length)
        {
          const def = ""+[SETTINGS.default.width, SETTINGS.default.height, SETTINGS.default.mines];
          for(let name in presets)
          {
            option.value = presets[name];
            option.textContent = name;
            option.className = option.value == def ? "default" : "";
            el.appendChild(option);
            option = option.cloneNode(false);
          }
          option.value = "";
          option.textContent = "Custom";
          el.appendChild(option);
        }
        el.value = ""+[SETTINGS.width, SETTINGS.height, SETTINGS.mines];
        if (!el.value)
          el.value = "";

        document.body.dataset[el.id] = el.value;

      }
      else
      {
        let max = SETTINGS.max[el.id],
            min = SETTINGS.min[el.id];
        for(let i = min, n = 0, def = SETTINGS.default[el.id], map = SETTINGS.map[el.id]||[]; i <= max; i++, n++)
        {
          option = el.children[n] || option.cloneNode(true);
          option.textContent = map[i] === undefined ? i : map[i];
          option.value = i;
          option.className = i == def ? "default" : "";
          if (!option.parentNode)
            el.appendChild(option);
        }
        if (!min)
          max++;

        while(el.children.length > max)
          el.removeChild(el.children[max]);

        el.value = SETTINGS[el.id];
      }
    }
    else
    {
      el.value = SETTINGS[el.id];
      el.min = SETTINGS.min[el.id];
      el.max = el.id == "mines" ? SETTINGS.width * SETTINGS.height - 1 : SETTINGS.max[el.id];
    }
    if (el.___inited)
      return;

    el.___inited = true;
    let timerInput, timerFilter;
    el.addEventListener("input", e => 
    {
      const isCheckbox = el.type == "checkbox",
            isSelect = el.tagName  == "SELECT";
      let value = isCheckbox ? el.checked : isSelect ? ~~el.value : Math.max(el.min, Math.min( ~~el.value, el.max));
  
      if (el.id == "openFirst")
        value = value;// ? settings.default[el.id] : 0;
      else if (el.id == "presets")
      {
        if (el.value != "")
        {
          value = el.value.split(",");
          SETTINGS.width = +value[0];
          SETTINGS.height = +value[1];
          SETTINGS.mines = +value[2];
          value += "";
        }
        else
        {
          value = "";
        }
      }

      if (!isCheckbox && !isSelect && SETTINGS.resetBoard[el.id]) /* text input */
      {
        clearTimeout(timerFilter);
        if (el.value != value)
        {
          timerFilter = setTimeout(() => (el.value = value, init(true)), 3000);
        }
      }
      SETTINGS[el.id] = value;
      const opts = {};
      opts[el.id] = value;
      setOptions(opts);
      if (isCheckbox)
        return;
  
      if (el.id != "mines")
      {
        const max = SETTINGS.width * SETTINGS.height - 1;
        EL.mines.max = max;
        if (~~EL.mines.value > max)
        {
          SETTINGS.mines = max;
          EL.mines.value = max;
        }
      }
      clearTimeout(timerInput);
      if (["presets"].includes(el.id) || SETTINGS.resetBoard[el.id])
        timerInput = setTimeout(() =>
        {
          init(true);
          setOptions();
        }, isSelect ? 0 : 300);
  
    });
  }
  
  {
    let scaling = false,
        timerZoom,
        clientX = 0,
        clientY = 0,
        mouseDown = null;
  
    EL.table.addEventListener("touchstart", e =>
    {
  
      if (e.touches.length === 2)
      {
        scaling = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        last = scaling;
        e.preventDefault();
      }
    });

    EL.table.addEventListener("touchmove", e =>
    {
      if (!scaling)
        return;
      
      // e.preventDefault();
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      let zoom = SETTINGS.zoom;
      // EL.difficulty.textContent = [settings.zoom, settings.min.zoom, settings.max.zoom];
  
      if (Math.abs(dist - scaling) > 10)
      {
        zoom += dist - scaling > 0 ? 1 : -1;
        if (zoom < SETTINGS.min.zoom)
          zoom = SETTINGS.min.zoom;
  
        if (zoom > SETTINGS.max.zoom)
          zoom = SETTINGS.max.zoom;
  
        scaling = dist;
        SETTINGS.zoom = zoom;
        timerZoom = setTimeout(setZoom, 10);
      }
  
    },{passive: false});
  
    EL.table.addEventListener("touchend", e =>
    {
      if (!scaling)
        return;
  
      scaling = false;
    });

    window.addEventListener("wheel", e =>
    {
      if (!isParent(e.target, "body") || e.ctrlKey)
        return;
  
      e.preventDefault();
      e.stopPropagation();
  
      let zoom = SETTINGS.zoom;
      // EL.difficulty.textContent = [settings.zoom, settings.min.zoom, settings.max.zoom];
  
      zoom += e.deltaY < 0 ? 1 : -1;
      if (zoom < SETTINGS.min.zoom)
        zoom = SETTINGS.min.zoom;
  
      if (zoom > SETTINGS.max.zoom)
        zoom = SETTINGS.max.zoom;
  
      SETTINGS.zoom = zoom;
      timerZoom = setTimeout(setZoom, 10);
  
    },{passive: false});
  
  
    function isParent(el, selector)
    {
      if (!el || !el.matches)
        return false;
  
      return el.matches(selector) || isParent(el.parentNode, selector);
    }

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
  EL.pause.addEventListener("click", e => pause());
  
  window.addEventListener("DOMContentLoaded", e =>
  {
    board = canvas().init();
    // board && board.draw();
//    init(!settings.table.length);
  });
  
  
  function pause(p)
  {
    if (p === undefined)
    {
      p = !SETTINGS.stats.pauseTime;
      if (p && !SETTINGS.stats.start)
        return setState();
    }
    if (p)
    {
      if (!SETTINGS.stats.start)
        return setState();
  
      SETTINGS.stats.pauseTime = new Date().getTime();
      SETTINGS.stats.pauseStart = SETTINGS.stats.start;
      SETTINGS.stats.start = 0;
      SETTINGS.stats.started = 1;
    }
    else
    {
      if (SETTINGS.stats.pauseTime )
      {
        SETTINGS.stats.start = new Date().getTime() - SETTINGS.stats.pauseTime  + SETTINGS.stats.pauseStart ;
      }
  
      SETTINGS.stats.pauseTime  = 0;
    }
    if (SETTINGS.stats.pauseTime || SETTINGS.stats.start)
      SETTINGS.stats.started = 1;

    setState();
    
    SETTINGS.save();
    init(false, false);
  }

  function setZoom(z)
  {
    if (z === undefined)
      z = SETTINGS.zoom;
    document.body.style.setProperty("--zoom", ((z/7*z/7) + 1) +"em");
    board && board.update();
  
  }

  function setState(f)
  {
    if (f === undefined)
      f = SETTINGS.stats.start ? STATE_STARTED : SETTINGS.stats.pauseTime ? STATE_PAUSED : STATE_STOPPED;

    document.body.dataset.state = ["", "start", "pause"][f];
    EL.pause.disabled = !f;
    EL.pause.textContent = ["Pause", "Pause", "Resume"][f];
  }

  function onClick(e)
  {
    e.preventDefault();
  
    if (gameStatus || dragScroll || e.target === EL.table || SETTINGS.stats.pauseTime || (e.type == "auxclick" && e.button == 2))
      return;
  
    const index = Array.from(EL.table.children).indexOf(e.target),
          leftClick = SETTINGS.click ? e.type != "click" : e.type == "click",
          table = SETTINGS.table;
  
    let val = table[index];
    if ((leftClick && (val & OPEN || val & FLAG || val & SHOW)) || (!leftClick && val & OPEN) || (!leftClick && !SETTINGS.stats.start))
      return;
  
    if (!SETTINGS.stats.start)
    {
      init(index);
      timer();
    }
    SETTINGS.stats.steps[SETTINGS.stats.steps.length] = (index << 1) | !leftClick; //set bit1 = flag

    setState();

    if (leftClick)
    {
      audio("dig");
      SETTINGS.table[index] &= ~QUESTION;
      openCell(index);
      if ((val & TYPE) == MINE)
      {
        SETTINGS.stats.time = new Date().getTime() - SETTINGS.stats.start;
        anim.explode.timer = anim.explode.duration+1;
        setTimeout(() =>
        {
          anim.explode.timer = 0;
          anim.explode.el.style.setProperty('--shakeX', '');
          anim.explode.el.style.setProperty('--shakeY', '');
          anim.explode.el.style.setProperty('--shakeR', '');
        }, anim.explode.duration);
        audio("explode");
        saveStats(0);
        return finished();
      }
    }
    else
    {
      let type = FLAG;
      if (table[index] & FLAG)
      {
        type = QUESTION;
        table[index] &= ~FLAG;
      }
      else if (table[index] & QUESTION)
      {
        type = 0;
        table[index] &= ~QUESTION;
      }
      else
      {
        type = FLAG;
      }

      table[index] |= type;

      audio("flag" + (type & FLAG ? "" : "off"));

      e.target.dataset.type = type;
      SETTINGS.stats.mines += val & FLAG ? -1 : val & QUESTION ? 0 : 1;
    }
  
    if (!(table[index] & OPEN + FLAG + QUESTION))
      delete e.target.dataset.type;
  
    if (isWon())
    {
      SETTINGS.stats.time = new Date().getTime() - SETTINGS.stats.start;
      audio(SETTINGS.stats.steps.length == perfect.val ? "perfect" : "win");
      saveStats(1);
      finished(true);
    }
    else
    {
      board && board.update();
    }
  
    SETTINGS.save();
    console.log(table[0], table[0] & FLAG, table[0] & QUESTION)
    //  e.target.textContent = val;
  }//onClick()

  function saveStats(win)
  {
    let stats = STATS[[SETTINGS.width,SETTINGS.height,SETTINGS.mines]],
    now = new Date().getTime(),
    table = SETTINGS.table;
    if (!stats[now])
      stats[now] = [];

    stats = stats[now];

    stats[STATS_RESULT] = ~~win;
    stats[STATS_STEPS] = [...SETTINGS.stats.steps];
    stats[STATS_MINES] = table.reduce((ret, v, i) => ((v & TYPE) == MINE && (ret[ret.length] = i), ret), []);
    stats[STATS_TIME] = SETTINGS.stats.time;
    stats[STATS_PERFECT] = perfect.val;
    STATS.save();
  }

  function finished(won)
  {
console.log("finished", won);
    SETTINGS.stats.start = 0;
    setState();
    // animation();
    animations.stop();
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
    let steps = SETTINGS.stats.steps.map(a => a >> 1);
    let mines = 0;
    const table = SETTINGS.table;
    for(let i = 0; i < table.length; i++)
    {
      const elCell = EL.table.children[i];
      if (table[i] & OPEN+FLAG+QUESTION)
      {
        elCell.classList.add("opened");
      }
      else
      {
        // table[i] |= SHOW;
        // elCell.classList.add("shown");
      }
      const type = table[i] & TYPE;
      if (type == MINE)
      {
        table[i] |= SHOW;
        elCell.classList.add("shown");
        elCell.dataset.type = type;
        if (won)
        {
          table[i] |= FLAG;
          table[i] &= ~QUESTION;
        }

        if (table[i] & FLAG)
          mines++;
      }
      // animation(elCell, type);
      if (table[i] & FLAG)
        elCell.classList.add("flag");

      if (table[i] & QUESTION)
        elCell.classList.add("question");
  
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
    SETTINGS.stats.mines = mines;
    anim.index = SETTINGS.stats.steps[SETTINGS.stats.steps.length - 1]>>1;
    EL.table.children[anim.index].classList.add("last");
    anim.shakeEl = EL.table.children[anim.index];//EL.table.querySelector('*[data-type="9"].shown.last:not(.flag).last');
    SETTINGS.save(); //save settings
    STATS.show();
    board && board.update();
  }//finished();

  function isFinished()
  {
    let good = 0,
        result = 0,
        table = SETTINGS.table,
        flagRequire = SETTINGS.flagRequire;
  
    for(let i = 0; i < table.length; i++)
    {
      const val = table[i],
            type = val & TYPE,
            isMine = type == MINE,
            isFlag = val & FLAG,
            isQuestion = val & QUESTION,
            isOpen = val & OPEN,
            isShow = val & SHOW;
  
      if ((isMine && ((flagRequire && isFlag) || (!flagRequire && !isOpen))) || (type != MINE && !isFlag && isOpen))
        good++;
  
      if (isShow || (isOpen && isMine && !isFlag))
        result = LOOSE;
    }
    return good == table.length ? WIN : result;
  }

  function isWon()
  {
    let opened = 0,
        mines = 0,
        flagRequire = SETTINGS.flagRequire,
        table = SETTINGS.table;
    for(let i = 0; i < table.length; i++)
    {
      const val = table[i],
            type = val & TYPE,
            isOpen = val & OPEN,
            isFlag = val & FLAG,
            isQuestion = val & QUESTION,
            isMine = type == MINE;
  
      if (val & SHOW || (isMine && isOpen) || (flagRequire && isMine && !isFlag))// || !((type != MINE && val & OPEN) || (type == MINE && val & FLAG)))
        return false;

      if (isOpen)
        opened++;

      if  (isMine)
        mines++;
    }
    return opened + mines == table.length;
  }

  function showDigits(el, text)
  {
    el.textContent = text;
    el.dataset.ghost = "".padEnd((""+text).length, 8);
  }

  function timer(timestamp)
  {
    if (timestamp === undefined)
    {
      SETTINGS.stats.start = new Date().getTime();
      SETTINGS.stats.started = 1;
    }
  
    if (timestamp - SETTINGS.stats.timestamp > 15)
    {
      SETTINGS.stats.timestamp = timestamp;
      if (SETTINGS.stats.start)
        SETTINGS.stats.time = new Date().getTime() - SETTINGS.stats.start;

      const time = showClock(EL.clock, SETTINGS.stats.time, true);
      showDigits(EL.minesFound, SETTINGS.mines - SETTINGS.stats.mines);
//      showDigits(EL.minesPercent, Math.round(SETTINGS.stats.mines * 100 / SETTINGS.mines));
      showDigits(EL.gamePercent, Math.round(SETTINGS.stats.open * 100 / (SETTINGS.table.length - SETTINGS.mines)));
      showDigits(EL.steps, SETTINGS.stats.steps.length);
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
    if (anim.explode.timer && timestamp - anim.explode.timer > 10)
    {
      anim.explode.timer = timestamp;
      anim.explode.el.style.setProperty("--shakeX", ~~(Math.random() * anim.explode.shake * 2 -anim.explode.shake) / 30 + "em");
      anim.explode.el.style.setProperty("--shakeY", ~~(Math.random() * anim.explode.shake * 2 -anim.explode.shake) / 30 + "em");
      anim.explode.el.style.setProperty("--shakeR", ~~(Math.random() * anim.explode.shake * 2 -anim.explode.shake) / 7  + "deg");
    }
    requestAnimationFrame(timer);
  }
  
  function showClock(el, time, minimum = false)
  {
    const prev = showPrev.get(el) || [];
    if (!prev.length)
      showPrev.set(el, prev);


    time = getTimeData(time).string;//.split(/[:.]/);

    for(let i = 0, val, hide = minimum; i < el.children.length; i++)
    {
      val = time[el.children[i].dataset.time];
      if (hide && i < 4)
      {
        val = val.replace(/^0/, "");

        if ((val && !val.match(/^0+$/)) || i > 3)
          hide = false;

      }
      if (prev[i] !== val)
      {
        showDigits(el.children[i], val);
        el.children[i].classList.toggle("hidden", i < 3 && hide);
        prev[i] = val;
      }
    }
    return time;
  }
  function getTime(time, minimum = false)
  {
    const t = getTimeData(time);
    let ret = (t.d ? t.d+"d":"") +
              (""+t.h).padStart(2,0) + ":" + 
              (""+t.m).padStart(2,0) + ":" + 
              (""+t.s).padStart(2,0) + "." + 
              (""+t.ms).padStart(3,0);
    return minimum ? ret.replace(/^(00:)+/, "") : ret;
  }
  
  function getTimeData(time)
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
    const item = SETTINGS.table[index],
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
      const nItem = SETTINGS.table[neighbors[i]] === undefined ? -(FLAG << 1) : SETTINGS.table[neighbors[i]],
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

  function showCell(index, animated)
  {
    const elCell = EL.table.children[index];

    if (animated)
    {
      elCell.classList.add("anim");
    }
    else
    {
      elCell.classList.add("shown");
      elCell.classList.remove("anim");
    }
    elCell.dataset.type = SETTINGS.table[index] & TYPE;
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
      table = SETTINGS.table;
    }

    let animation;
    if (animate && SETTINGS.animation)
    {
      animation = animations.new({start: true});
    }
    while(array.length)
    {
      index = array.shift();
      if (table[index] === undefined)
        break;

      let isOpen = table[index] & OPEN;
      if (isOpen)
        continue;

      if (show)
      {

        showCell(index, animation);
        animation && animation.add(index);
      // const borders = getBorders(index);
      // for(let b = 0; b < borders.length; b++)
      //   elCell.classList.toggle(BORDERS[b], Boolean(borders[b]));

        if (!isOpen)
          SETTINGS.stats.open++;

      }
      table[index] |= OPEN;
      ret[index] = table[index];

      if (table[index] == OPEN)
      {
        let offset = [];
//        OFFSET.push(OFFSET.shift(), OFFSET.shift());
        for(let o = 0; o < OFFSET.length; o+=2)
        {
          offset[o/2] = [OFFSET[o], OFFSET[o+1]];
        }
        // offset.sort( () => .5 - Math.random() );
        for(let o = 0; o < offset.length; o++)
        {
          const i = getIndexOffset(index, offset[o][0], offset[o][1]),
                val = table[i];

          if (!(val === undefined || val == MINE || val & FLAG || val & QUESTION || table[i] & OPEN))
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
  
  function init(reset = false, checkPause = true)
  {
    const index = typeof reset == "number" ? reset : -1;

    if (typeof reset == "number")
      reset = false;

    if (checkPause)
      SETTINGS.stats.started = 0;

    animations.stop();
    gameStatus = 0;
    EL.table.className = "";
    document.body.classList.remove("finished");
    document.body.classList.remove("won");
    SETTINGS.stats.timestamp = 0;
    // let opened = false;
    // for(let i = 0, mask = OPEN + FLAG; i < SETTINGS.table.length; i++)
    // {
    //   if (SETTINGS.table[i] & mask)
    //   {
    //     opened = true;
    //     break;
    //   }
    // }
    // if(!opened)
    //   reset = true;
  
    if (reset)
    {
      for(let i in SETTINGS.stats)
        SETTINGS.stats[i] = 0;
  
      SETTINGS.stats.steps = [];
      SETTINGS.table.length = 0; //reset
    }
    SETTINGS.table.length = SETTINGS.width * SETTINGS.height;
    if (index > -1)
    {
      const max = Math.min(SETTINGS.mines, SETTINGS.table.length - 2);
      let mines = 0,
          indexes = OFFSET.reduce((ret, o, i)=>
          {
            if (i % 2)
            {
              const i = getIndexOffset(index, ret[ret.length-1], o);
              if (i < 0)
                return ret.length--, ret;

              ret[ret.length-1] = i;
            }
            else
              ret[ret.length] = o;
            return ret;
          }, [index]);

      while(mines < max)
      {
        const mine = rand(0, SETTINGS.table.length-1);
        if (!indexes.includes(mine) && !SETTINGS.table[mine])
        {
          mines++;
          SETTINGS.table[mine] = MINE;
        }
      }
    }
    while(EL.table.children.length > SETTINGS.table.length)
      EL.table.removeChild(EL.table.lastChild);
  
    let started = false,
        flags = 0,
        mines = 0,
        paused = SETTINGS.stats.pauseTime,
        perfectSteps = [],
        perfectList = {},
        empty = [],
        notEmpty = [],
        newTable = [];

    perfect[0] = 0;
    perfect[1] = 0;
    for(let i = 0, OPENED = OPEN + SHOW, table = SETTINGS.table; i < table.length; i++)
    {
      const elCell = EL.table.children[i] || document.createElement("span"),
            item = table[i];
  
      let itemType = item & TYPE;
  
      if (!elCell.parentNode)
        EL.table.appendChild(elCell);
  
      elCell.className = "";
      elCell.removeAttribute("style");
      for(let i in elCell.dataset)
        delete elCell.dataset[i];

      elCell.title = "";
      if (paused)
      {
        delete elCell.dataset.type;
      }
      if (index > -1)
      {
        let minesNum = 0;
        if (item != MINE)
        {
          for(let o = 0; o < OFFSET.length; o+=2)
          {
            let index = getIndexOffset(i, OFFSET[o], OFFSET[o+1]); //right
    // console.log(i, index, mines);
            if (table[index] == MINE)
              minesNum++;
          }
          table[i] = itemType = minesNum;
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
          if (!paused)
            elCell.dataset.type = itemType;

          // animation(elCell, item & TYPE);
          started = true;
        }
        if(item & FLAG)
        {
          if (!paused)
            elCell.dataset.type = FLAG;

          flags++;
          started = true;
        }
        if(item & QUESTION)
        {
          if (!paused)
            elCell.dataset.type = QUESTION;

          started = true;
        }

      }
      if ((table[i] & TYPE) == MINE)
        mines++;
      else
      {
        if (table[i] & TYPE)
          notEmpty[notEmpty.length] = i;
        else
        {
          empty[empty.length] = i;
          // elCell.classList.add("empty");
        }
      }
      newTable[newTable.length] = itemType;
    }//for settings.table
    const _table = Object.assign([], newTable);
    for(let i = 0, table = SETTINGS.table; i < table.length; i++)
    {
      if (perfectList[i] !== undefined || (table[i] & TYPE) != 0)
        continue;
  
      Object.assign(perfectList, openCell(i, _table, false));
      perfect[0]++;
      perfect[1]++;
      perfectSteps[perfectSteps.length] = i;
    }

    for(let i = 0, table = SETTINGS.table; i < table.length; i++)
    {
      if (perfectList[i] === undefined && (table[i] & TYPE) != MINE)
      {
        perfect[0]++;
        perfect[1]++;
        perfectList[i] = table[i];
        perfectSteps[perfectSteps.length] = i;
      }
    }
    // console.log(perfectList);
  
    if (SETTINGS.openFirst && started && difficulty() > difficultyCheat)
    {
      perfect[0]--;
      perfect[1]--;
    }
  // console.log(perfect, mines, perfectSteps);
    // if (flags !== settings.stats.mines)
    // {
    //   settings.stats.mines = flags;
    // }
    let {width, height} = getWidthHeight();

    document.body.style.setProperty("--cols", width);
    document.body.style.setProperty("--rows", height);
    // for(let i = 0; i < settings.height; i++)
    //   console.log(settings.table.slice(i * settings.width, i * settings.width + settings.width));
    
    // showDigits(EL.minesTotal, SETTINGS.mines);

    SETTINGS.save(); //save settings
    timer(0);
    const finish = isFinished();
    if (finish)
      finished(finish == WIN);
  
    EL.difficulty.textContent = Object.keys(presets)[Math.min(~~(difficulty() * 3 / 11), 11)];// + " [" + ~~(difficulty()) + "%]";
    EL.menuDifficulty.textContent = EL.difficulty.textContent;
    EL.difficulty.dataset.value = ~~(difficulty() + 1);
  
    if (!started && SETTINGS.openFirst && difficulty() > difficultyCheat)
    {
      // empty.forEach(e => {
      //   if (!(settings.table[e] & OPEN))
      //   {
      //     openCell(e);
      //     perfect--;
      //   }
      // });

      let list = empty;

      if (empty.length)
      {
        perfect[0]--;
        perfect[1]--;
      }
      else if(notEmpty.length > 1)
        list = notEmpty;

      if (list.length)
        openCell(list[~~(rand(0, list.length-1))], undefined, false);
  
    }
    perfect[1] += mines;

    board && board.update();
    if (checkPause)
    {
      showDigits(EL.perfect, index == -1 && !started ? 0 : perfect.val);
      pause(SETTINGS.stats.pauseTime);
      if (!finish)
        STATS.show();
    }

  }// init();
  
  function difficulty()
  {
    return SETTINGS.mines * 100 / (SETTINGS.width * SETTINGS.height);
  }

  function getWidthHeight(width, height)
  {
    if (width === undefined) 
      width = SETTINGS.width;
    if (height === undefined)
      height = SETTINGS.height;

    if (window.innerHeight > window.innerWidth)
    {
      [width,height] = [height,width];
    }
    return {width, height};
  }

  function indexToXY(index, w = SETTINGS.width, h = SETTINGS.height)
  {
    const {width, height} = getWidthHeight(w, h);
    return {x: index % width, y: ~~(index / width), width, height};
  }
  
  function getIndexOffset(index, offsetX, offsetY)
  {
    let {x, y, width, height} = indexToXY(index);
    x += offsetX;
    y += offsetY;
    if (x < 0 || x > width-1 || y < 0 || y > height-1)
      return -1;
  
    return y * width + x;
  }
  
  
  
  function setTheme(theme)
  {
    if (theme === undefined)
      theme = SETTINGS.darkMode;
  
    if (theme == 2)
      document.documentElement.removeAttribute("theme");
    else
      document.documentElement.setAttribute("theme", SETTINGS.darkMode ? "dark" : "light");
  
    SETTINGS.darkMode = theme;
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
          bits = Math.log2(MAX) + 1,
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
        bits = Math.log2(MAX) + 1,
        max = ~~(32 / bits),
        mask = (MAX << 1) - 1;
  
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
        this.ctx.width = SETTINGS.width * this.cellSize + this.shadowSize*2;
        this.ctx.height = SETTINGS.height * this.cellSize + this.shadowSize*2;
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
        this.ctx.width = SETTINGS.width * this.cellSize + this.shadowSize*2;
        this.ctx.height = SETTINGS.height * this.cellSize + this.shadowSize*2;
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
  
        for(let i = 0, value, type; i < SETTINGS.table.length; i++)
        {
          value = SETTINGS.table[i];
          type = SETTINGS.table[i] & TYPE;
          if (value & FLAG)
            flags[flags.length] = i;
          else if (type == MINE && (value & SHOW || value & OPEN))
            mines[mines.length] = i;
          else
            reg[reg.length] = i;
  
        }
        mines.reverse();
        const mine = mines.indexOf(SETTINGS.table.indexOf(MINE + OPEN));
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
        this.steps = SETTINGS.stats.steps.map(a => a >> 1);
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
              value = SETTINGS.table[index],
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
