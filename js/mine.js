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
        ROCK = 10,
        OPEN = 16,
        SHOW = 32,
        FLAG = 64,
        QUESTION = 128,
        MAX = QUESTION,
        TYPE = OPEN - 1,
        WIN = 1,
        LOOSE = 2,
        NW = 0,
        N = 1,
        NE = 2,
        E = 3,
        SE = 4,
        S = 5,
        SW = 6,
        W = 7,
        STATE_STOPPED = 0,
        STATE_STARTED = 1,
        STATE_PAUSED = 2,
        STATS_RESULT = 0, /* flags saved in steps, bit 1 = flag */
        STATS_TIME = 1,
        STATS_STEPS = 2,
        STATS_PERFECT = 3,
        STATS_MINES = 4,
        STATS_ROCKS = 5,
        OFFSET = [-1,-1,0,-1,1,-1,1,0,1,1,0,1,-1,1,-1,0], //offset around current coordinate
        anim = {
          blink: 0,
          shake: 0,
          shakeFrame: 50,
          index: -1,
          explode:
          {
            el: EL[".tableBox"],
            shake: 6, //intensity
            timer: 0,
            duration: 500, //duration
          },
        },
        tableBox = EL.table.parentNode.parentNode.parentNode,
        ID = ["width", "height", "mines", "rocks"],
        rockDifficulty = 1.2,
        difficultyMultiplier = 2,
        PRESETS = {/* [ width, height, mines ] */
          "Can't loose": [9,9,2,0],
          "Don't wanna think": [9,9,5,0],
          "Super easy": [9,9,7,2],
          "Easy": [16,16,25,0],
          "Normal": [16,16,32,0],
          "Medium": [16,16,37,5],
          "Hard": [30,16,90,0],
          "Very hard": [30,16,90,9],
          // "I can do this!": [30,30,264,0],
          // "I'll try it anyway": [30,30,200,49],
          "Impossible": [30,30,213,6],
          // "Gotta buy a lottery": [30,30,363,0],
        },
        SETTINGS = new Proxy(
        {
          width: {default: 16, value: 16, min: 9, max: 100, resetBoard: true},
          height: {default: 16, value: 16, min: 9, max: 100, resetBoard: true},
          mines: {default: 32, value: 32, min: 2, max: 9998, resetBoard: true},
          rocks: {default: 0, value: 0, min: 0, max: 9998, resetBoard: true},
          zoom: {default: 3, value: 3, min: 1, max: 70},
          questionMark: {default: true, value: true},
          darkMode: {default: 0, value: 0, min: 0, max: 2},
          table: {default: [], value: []},
          animation: {default: 10, value: 10, min: 0, max: 20, onChange: val => animations.steps(val), map:["None"]},
          monochrome: {default: false, value: false, onChange: val => board && board.update()},
          audio: {default: true, value: true},
          showSteps: {default: true, value: true},
          flagRequire: {default: false, value: false, onChange: val => !gameStatus && SETTINGS.stats.time && showDigits(EL.perfect, perfect.val)},
          stats: {
            start: 0,
            started: 0,
            mines: 0,
            rocks: 0,
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
                if ((key == "mines" || key == "rocks") && prop == "max")
                {
                  target[key][prop] = this.getMax(target, key);
                }
                obj[key] = target[key][prop];
                return obj;
              }, {});
            }
            return target[prop] && (target[prop].value === undefined ? target[prop] : target[prop].value);
          }, //get()
  
          getMax(target, prop)
          {
            return (target[prop].max = Math.max(0, target.width.value * target.height.value - (prop == "rocks" ? target.mines.value * rockDifficulty + 2 : 2)));
          },

          set(target, prop, value, proxy)
          {
            let v = value;
            value = this.check(target, prop, value);
            if (value === undefined)
              return;
  
            target[prop].value = value;
            if (target[prop].onChange instanceof Function)
              target[prop].onChange(value);
  
            if (prop == "width" || prop == "height")
            {
              this.getMax(target, "mines");
              this.getMax(target, "rocks");
            }
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
              const stats = this._stats[this.id()];
              if (stats && stats[prop] !== undefined)
                return stats[prop];

              if ((prop.constructor !== Symbol) && (""+prop).match(/[0-9]+,[0-9]+,[0-9]+,[0-9]+/))
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
              obj = this._stats[this.id()] || {};

            const isAll = obj === this._stats.all,
                  pref = "stats_" + (isAll ? "all_" : ""),
                  boardSizeText = ["x", "⛯", "☁", ""];

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
          id(target, value)
          {
            const ret = [];
            if (value === undefined)
              value = SETTINGS;
            else
              value = SETTINGS[value];

            for(let i = 0; i < ID.length; i++)
            {
              ret[ret.length] = value[ID[i]];
            }
            return ""+ret;
          },
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

          list(target, value = this.id())
          {
            return this.get(target, value);
          },

        }),//stats

        animations = (()=>
        {
          const workers = new Map(),
                WORKER_URL = URL.createObjectURL(new Blob(["(" + (() =>
                {
                  
const pref = {},
      frames = [],
      closeTimer = (t = 60000) => closeTimer.timer = setTimeout(commands.close, t);
      commands = {
        start: (() => 
        {
console.log("start");
          pref.status = 1,
          this.postMessage({pref});
          loop();
        }).bind(this),
        stop: (() =>
        {
console.log("stop");
          pref.status = 0;
          const array = frames.reduce((ret, a) => (a && a.length && (ret[ret.length] = a), ret), []);
          this.postMessage({array, pref, count: 0});
          closeTimer();
          frames.length = 0;
          return;
        }).bind(this),
        pause: (() =>
        {
console.log("pause");
          pref.status = 2;
          this.postMessage({pref});
        }).bind(this),
        close: (() =>
        {
console.log("close");

          pref.status = -1;
          this.postMessage({pref});
        }).bind(this)
      };
      
let prevRet,
    INDEX = null,
    width, height,
    count = -1,
    x,y;
let first;
function indexToXY(index)
{
  return {x: index % width, y: ~~(index / width)};
}
this.addEventListener("message", e =>
{
  const data = e.data;
  let xy;
  for(let i in data)
  {
    switch(i)
    {
      case "init":
        width = data[i].width;
        height = data[i].height;
        INDEX = data[i].index;
        xy = indexToXY(INDEX);
        x = xy.x;
        y = xy.y;
        count = -1;
        break;
      case "index":
        const index = data[i];
        xy = indexToXY(index);
        if (count == -1)
        {
console.log("added", index);
first = true;
          count = 0;
        }

        count++;
        const dist = ~~Math.hypot(xy.x - x, xy.y - y);
        if (!frames[dist])
          frames[dist] = [];

        const frame = frames[dist];
        frame[frame.length] = index;
        // array[array.length] = data[i];
        break;
      case "pref":
        for(let o in data[i])
          pref[o] = data[i][o];
        break;
      case "command":
        if (commands[data[i]] instanceof Function)
          commands[data[i]](data.args);
        break;
    }
  }
});


const loop = (timestamp = performance.now()) =>
{
  if (!pref.status)
    return;

  clearTimeout(closeTimer.timer);
  setTimeout(loop);

  if (pref.status != 1 || (pref.steps && timestamp - pref.timer < pref.speed - pref.steps))
    return;

  if (timestamp && !pref.steps)
    return commands.stop();

  if (pref.delay && pref.timer == -1)
  {
    pref.timer = timestamp + pref.delay - pref.speed - pref.steps;
    return;
  }
  const ret = {array: [], pref};
  for(let i = 0; i < frames.length; i++)
  {
    if (!frames[i])
      continue;

    if (!ret.array.length && frames[i].length)
    {
      ret.array = [...frames[i]];
      count -= frames[i].length;
      frames[i].length = 0;
      break;
    }
  }
  ret.count = count;
  // for (let i = 0, max = Math.min(pref.steps, array.length); i < max; i++)
  // {
  //   if (!array.length)
  //     break;

  //   ret.array[ret.array.length] = array.shift();
  // }
  pref.timer = timestamp;
  if (prevRet === ""+ret.array)
    return;
if (first) {
  console.log(ret);
  first = false;
}
  this.postMessage(ret);
  prevRet = "" + ret.array;
};
closeTimer();

                }).toString() + ")()"], { type: "text/javascript" }));
          class Animation
          {
            constructor(opt = {})
            {
              this.pref = {};
              let i = workers.size,
                  now = new Date();
              for(let [_this, _pref] of workers)
              {
                let that = _this;
                if (now - _this.date > 60000)
                  this.delete(_this);

                if (!_this.status && !this.worker)
                {
                  this.worker = _this.worker;
                  this.pref = _pref;
                  that = this;
                }
                //replace old workers with new
                workers.delete(_this);
                workers.set(that, _pref);
                if (!--i)
                  break;
              }
              if (!this.worker)
              {
                this.worker =  new Worker(WORKER_URL);
                this.id = workers.size;
              }
              this.worker.onerror = e => console.error(e);
              let first;
              this.opened = new Map();
              this.worker.onmessage =  e =>
              {
// console.log("onMessage", e.data);
                const {array, pref, count} = e.data;
                Object.assign(this.pref, pref);
                if (this.pref.status == -1)
                {
                  if (workers.size > 1)
                    return this.delete();
                }
                this.date = new Date();
                if (!SETTINGS.stats.started)
                  return;

                if (array !== undefined)
                {
                  for(let i = 0; i < array.length; i++)
                  {
                    let a = array[i];
                    if (!(a instanceof Array))
                      a = [a];

                    for(let i = 0; i < a.length; i++)
                    {
                      for(let o = 0; o < OFFSET.length; o += 2)
                      {
                        const oi = getIndexOffset(a[i], OFFSET[o], OFFSET[o + 1]);
                        if (this.opened.has(oi))
                          continue;

                        // openCell(oi, this.table, false, true);
                        // this.table[oi] |= OPEN;
                        board.drawCell({index:oi, table: this.table});
                        // this.opened.set(oi, "");
                      }
                      if (!this.opened.has(a[i]))
                      {
                        this.table[a[i]] |= OPEN;
                        board.drawCell({index:a[i], table: this.table});
                      }

                      this.opened.set(a[i], "");
                      if (!first) {
                        console.log(first, array);
                        first = true;
                      }
                    }
                  }
                  if (!count || !this.status)
                  {
                    if (this.status)
                    {
                      this.stop();
                    }

                    // workers.delete(this);
                    // this.worker.terminate();
                  }
                }
              };
              this.date = now;
              this.status = 1;
              this.steps = 1;///opt.animation === undefined ? SETTINGS.animation : opt.animation;
              this.speed = SETTINGS.animation ? (SETTINGS.max.animation+1 - SETTINGS.animation) * 5 - 4 : 0;//30;
              console.log("speed", this.speed);
              this.message({init:{index:opt.index, width:SETTINGS.width, height: SETTINGS.height}});
              if (opt.start)
                this.start();

              workers.set(this, this.pref);
              this.table = opt.table || [];
            }
            message(data)
            {
              this.worker.postMessage(data);
            }
            start()
            {
              this.message({command:"start"});
            }
            pause()
            {
              this.message({command:"pause"});
            }
            stop()
            {
              this.message({command:"stop"});
            }
            add(data)
            {
              this.message({index: data});
            }
            delete(that = this)
            {
              if (workers.size > 1)
              {
                that.status = -1;
                that.worker.terminate();
                workers.delete(that);
                return;
              }
              that.status = 0;
              that.message({pref: that.pref});
            }
            get date() {return this.pref.date;}
            set date(data)
            {
              this.pref.date = data;
            }
            get id() {return this.pref.id;}
            set id(data)
            {
              this.pref.id = data;
              this.message({pref: this.pref});
            }
            get speed() {return this.pref.speed;}
            set speed(data)
            {
              this.pref.speed = data;
              this.message({pref: this.pref});
            }
            get delay() {return this.pref.delay;}
            set delay(data)
            {
              this.pref.delay = data;
              this.message({pref: this.pref});
            }
            get steps() {return this.pref.steps;}
            set steps(data)
            {
              this.pref.steps = data;
              this.message({pref: this.pref});
            }
            get status(){ return this.pref.status;}
            set status(status){
              this.pref.status = status;
              this.message({pref: this.pref});
            }
          }//class Animation

          return {
            new: (opt) => new Animation(opt),
            start: () =>
            {
              workers.forEach((status, anim) => anim.status && anim.start());
            },
            pause: () =>
            {
              workers.forEach((status, anim) => anim.status && anim.pause());
            },
            stop: () =>
            {
              workers.forEach((status, anim) => anim.status && anim.stop());
            },
            steps: (data) =>
            {
              workers.forEach((status, anim) => anim.steps = data);
            },
            list: workers
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
      perfect = [0,0]; //0: flagRequire off, 1: flagRequire on

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
  document.fonts.ready.then(e =>
  {
    board = canvas().init();
  });
  
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
      STATS.clear(e.target.classList.contains("board") ? STATS.id() : undefined);
    });
  });
  function setOptions(opts)
  {
    if (opts === undefined)
    {
      opts = SETTINGS.toJSON();
      opts.presets = STATS.id();
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
          const def = STATS.id("default");
          for(let name in PRESETS)
          {
            option.value = PRESETS[name];
            option.textContent = name;
            option.className = option.value == def ? "default" : "";
            el.appendChild(option);
            option = option.cloneNode(false);
          }
          option.value = "";
          option.textContent = "Custom";
          el.appendChild(option);
        }
        el.value = STATS.id();
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

        while(el.children.length > 1 && el.children.length > max)
          el.removeChild(el.children[el.children.length-1]);

        el.value = SETTINGS[el.id];
      }
    }
    else
    {
      el.value = SETTINGS[el.id];
      el.min = SETTINGS.min[el.id];
      el.max = SETTINGS.max[el.id];
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
  
      if (el.id == "presets")
      {
        if (el.value != "")
        {
          value = el.value.split(",");
          for(let i = 0; i < ID.length; i++)
          {
            SETTINGS[ID[i]] = ~~value[i];
// console.log(ID[i], value[i], SETTINGS[ID[i]], SETTINGS.max[ID[i]]);
          }
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


      // if (el.id != "mines")
      // {
      //   const max = SETTINGS.width * SETTINGS.height - 1;
      //   EL.mines.max = max;
      //   if (~~EL.mines.value > max)
      //   {
      //     SETTINGS.mines = max;
      //     EL.mines.value = max;
      //   }
      // }
      clearTimeout(timerInput);
      if (["presets"].includes(el.id) || SETTINGS.resetBoard[el.id])
      {
        timerInput = setTimeout(() =>
        {
          init(true);
          setOptions();
        }, isSelect ? 0 : 300);
      }
  
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
  EL.pause.addEventListener("click", e => pause());
  document.fonts.ready.then(e =>
  {
  });
 
  window.addEventListener("DOMContentLoaded", e =>
  {
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

    p = setState();
    
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
    return f;
  }

  function saveStats(win)
  {
    let stats = STATS[STATS.id()],
    now = new Date().getTime(),
    table = SETTINGS.table;
    if (!stats[now])
      stats[now] = [];

    stats = stats[now];
    const mines = [],
          rocks = [];
    for(let i = 0; i < table.length; i++)
    {
      const type = table[i] & TYPE;
      if (type == MINE)
        mines[mines.length] = i;
      else if (type == ROCK)
        rocks[rocks.length] = i;
    }
    stats[STATS_RESULT] = ~~win;
    stats[STATS_STEPS] = [...SETTINGS.stats.steps];
    stats[STATS_MINES] = mines;
    stats[STATS_ROCKS] = rocks;
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
      const type = table[i] & TYPE;
      if (type == MINE)
      {
        table[i] |= SHOW;
        if (won)
        {
          table[i] |= FLAG;
          table[i] &= ~QUESTION;
        }

        if (table[i] & FLAG)
          mines++;
      }
  
    }
    SETTINGS.stats.mines = mines;
    anim.index = SETTINGS.stats.steps[SETTINGS.stats.steps.length - 1]>>1;
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
            isRock = type == ROCK,
            isShow = val & SHOW;
  
      if (type == ROCK || (isMine && ((flagRequire && isFlag) || (!flagRequire && !isOpen))) || (type != MINE && !isFlag && isOpen))
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
        rocks = 0,
        flagRequire = SETTINGS.flagRequire,
        table = SETTINGS.table;
    for(let i = 0; i < table.length; i++)
    {
      const val = table[i],
            type = val & TYPE,
            isOpen = val & OPEN,
            isFlag = val & FLAG,
            isQuestion = val & QUESTION,
            isRock = type == ROCK,
            isMine = type == MINE;
  
      if (val & SHOW || (isMine && isOpen) || (flagRequire && isMine && !isFlag))// || !((type != MINE && val & OPEN) || (type == MINE && val & FLAG)))
        return false;

      if (isOpen)
        opened++;

      if (isMine)
        mines++;

      if (isRock)
        rocks++;
    }
    return opened + mines + rocks == table.length;
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
    const borders = [];
    for(let i = 0; i < OFFSET.length; i+=2)
    {
      const neighbor = getIndexOffset(index, OFFSET[i], OFFSET[i+1]),
            nItem = neighbor < 0 ? OPEN : SETTINGS.stats.started || SETTINGS.stats.time ? SETTINGS.table[neighbor] : MINE,
            value = nItem,//SETTINGS.table[neighbor],
            type = value & TYPE,
            isMine = type == MINE,
            isFlag = value & FLAG,
            isOpen = value & OPEN,
            isShow = value & SHOW;
      borders[i/2] = !!(isOpen || (isMine && isShow && !isFlag));
    }
if (index == 36)
console.log(borders)
    return borders;
  }

  function openCell(index, table, animate = true, single = false)
  {
    const array = [index],
          ret = {};

    let show = false;
    if (!table)
    {
      show = true;
      table = SETTINGS.table;
    }

    let animation, _table = table;
    if (animate && SETTINGS.animation)
    {
      _table = [...table];
      animation = animations.new({start: true, index, table: _table});
    }
// console.log(table);
    const shown = new Map();
    while(array.length)
    {
      let nIndex = array.shift();
      if (table[nIndex] === undefined)
        break;

      let isOpen = table[nIndex] & OPEN;
      if (isOpen)
        continue;

      table[nIndex] |= OPEN;
      if (show)
      {
        if (nIndex == index)
          board && board.showCell({index:nIndex, around:show, shown, table: _table});
        else
          board && board.drawCell({index:nIndex, table: _table});
        

          animation && animation.add(nIndex);

        if (!isOpen)
          SETTINGS.stats.open++;

      }
      ret[nIndex] = table[nIndex];

      if ((!animation || !single) && table[nIndex] == OPEN)
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
          const i = getIndexOffset(nIndex, offset[o][0], offset[o][1]),
                val = table[i],
                type = val & TYPE;

          if (!(val === undefined || val == MINE || val & FLAG || val & QUESTION || type == ROCK || table[i] & OPEN))
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
    // animations.pause();
    gameStatus = 0;
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
      let mines = 0,
          rocks = 0,
          minesMax = Math.min(SETTINGS.mines, SETTINGS.max.mines),
          rocksMax = Math.min(SETTINGS.rocks, SETTINGS.max.rocks),
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

      if (rocksMax)
      while(rocks < rocksMax)
      {
        const rock = rand(0, SETTINGS.table.length-1);
        if (!indexes.includes(rock) && !SETTINGS.table[rock])
        {
          rocks++;
          SETTINGS.table[rock] = ROCK;
        }
      }
      while(mines < minesMax)
      {
        const mine = rand(0, SETTINGS.table.length-1);
        if (!indexes.includes(mine) && !SETTINGS.table[mine])
        {
          mines++;
          SETTINGS.table[mine] = MINE;
        }
      }
    }
  
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
      const item = table[i];
  
      let itemType = item & TYPE;
  
      if (index > -1)
      {
        let minesNum = 0;
        if (item != MINE && item != ROCK)
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

          // animation(elCell, item & TYPE);
          started = true;
        }
        if(item & FLAG)
        {

          flags++;
          started = true;
        }
        if(item & QUESTION)
        {

          started = true;
        }

      }
      const type = table[i] & TYPE;
      if (type == MINE)
        mines++;
      else
      {
        if (type)
        {
          if (type != ROCK)
            notEmpty[notEmpty.length] = i;
        }
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
      const type = table[i] & TYPE;
      if (perfectList[i] !== undefined || type != 0 || type == ROCK)
        continue;
  
      Object.assign(perfectList, openCell(i, _table, false));
      perfect[0]++;
      perfect[1]++;
      perfectSteps[perfectSteps.length] = i;
    }

    for(let i = 0, table = SETTINGS.table; i < table.length; i++)
    {
      const type = table[i] & TYPE;
      if (perfectList[i] !== undefined || type == MINE || type == ROCK)
        continue;

      perfect[0]++;
      perfect[1]++;
      perfectList[i] = table[i];
      perfectSteps[perfectSteps.length] = i;
    }
    // console.log(perfectList);
  
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
console.log("finishedddd", finish)
    if (finish)
      finished(finish == WIN);
  
    const diff = Math.min(100, Math.max(0, ~~(difficulty()))),
          presets = Object.keys(PRESETS),
          preset = ~~(diff*(presets.length-1)/100);
console.log(diff, preset,presets[preset])
    EL.difficulty.textContent = presets[preset];// + " [" + ~~(difficulty()) + "%]";
    EL.menuDifficulty.textContent = diff;
    EL.difficulty.dataset.value = diff;
  
    perfect[1] += mines;

    if (checkPause)
    {
      showDigits(EL.perfect, index == -1 && !started ? 0 : perfect.val);
      pause(SETTINGS.stats.pauseTime);
      if (!finish)
        STATS.show();
        board && board.update();
    }

  }// init();
  
  function difficulty(width = SETTINGS.width, height = SETTINGS.height, mines = SETTINGS.mines, rocks = SETTINGS.rocks)
  {
    return (mines * difficultyMultiplier) * 100 / ((width * height) - (rocks * rockDifficulty));
  }

  function getWidthHeight(width = SETTINGS.width, height = SETTINGS.height)
  {
    if (window.innerHeight > window.innerWidth)
    {
//      [width,height] = [height,width];
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
    return class Canvas
    {
      constructor()
      {
        this.canvas = EL.table;
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
        // const style = getComputedStyle(this.canvas);
        // this.cellSize = 16;//parseFloat(style.fontSize);
        // this.offset = this.cellSize / 2.74075;
        // this.textSize = this.cellSize - this.offset + 0.5;
        // this.textSizeSmall = this.textSize / 3.5;
        // this.shadowSize = this.cellSize / 10;
        // this.ctx.width = SETTINGS.width * this.cellSize + this.shadowSize*2;
        // this.ctx.height = SETTINGS.height * this.cellSize + this.shadowSize*2;
        // this.canvas.width = this.ctx.width;
        // this.canvas.height = this.ctx.height;
        this.images = {};
        this.style = {};
        this.loadImages();
        this.loadColors();
        this.canvas.addEventListener("mousemove", this.onMove.bind(this));
        this.canvas.addEventListener("click", this.onClick.bind(this));
        this.canvas.addEventListener("auxclick", this.onClick.bind(this));
        this.canvas.addEventListener("contextmenu", this.onClick.bind(this));
        this.canvas.addEventListener("mouseout", this.onMove.bind(this));
        this.prevCell = null;
        this.hoverCell = -1;
        this.update();
      }
      onMove(e)
      {
        // console.log(e);
        const index = this.eventToIndex(e);
        if (index == this.hoverCell || this.isFinished)
          return;

        this.drawCell({index: this.hoverCell});
        this.drawCell({index, hover: true});
        this.hoverCell = index;
      }
      eventToIndex(e)
      {
        let rect = e.target.getBoundingClientRect(),
            x = e.clientX-rect.left,
            y = e.clientY-rect.top;
        if (x < 0 || x > this.width-1 || y < 0 || y > this.height-1)
          return -1;
        
        return this.xyToIndex(x, y);
      }
      xyToIndex(x, y)
      {
        x = ~~((x-1) / this.cellSize);
        y = ~~((y-1) / this.cellSize);
        return y * SETTINGS.width + x;
      }
      update(index = -1)
      {
        const style = getComputedStyle(this.canvas);
        this.cellSize = SETTINGS.zoom * 8;// parseFloat(style.fontSize);
        this.offset = this.cellSize / 8;
        this.textSize = this.cellSize - this.offset;// + 0.5;
        this.textSizeSmall = this.textSize / 3.5;
        this.shadowSize = this.cellSize / 10;
        this.width = SETTINGS.width * this.cellSize + 1;// + this.shadowSize*2;
        this.height = SETTINGS.height * this.cellSize + 1;// + this.shadowSize*2;
        this.font = "bold " + this.textSize + "px " + this.style.font;
        this.fontSmall = this.textSizeSmall + "px " + this.style.font;
        this.ctx.font = this.font;
        this.ctx.textBaseline = "middle";
        this.ctx.textAlign = "center";
        this.ctx.lineWidth = 1;
        // this.ctx.clearRect(0, 0, this.ctx.width, this.ctx.height);
        this.ctx.fillStyle = this.style.fill;
        this.ctx.fillRect(0, 0, this.width, this.height);
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
        this.draw(index);
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
          flagGood: EL.imgFlagGood,
          flagBad: EL.imgFlagBad,
          mine: EL.imgMine,
          question: EL.imgQuestion
        };
        for(let i in imgs)
        {
          const url = getComputedStyle(imgs[i]).backgroundImage.slice(4, -1).replace(/"/g, "");
          this.images[i] = new Promise((resolve, reject) =>
          {
            const img = new Image();
            console.log(i, url);
            img.onload = e => resolve(img);
            img.onerror = e => reject(i, url);
            img.src = url;
          });
        }
      }
  
      loadColors()
      {
        const vars = ["stroke", "fill", "flag", "mineGood", "mineBad", "mineOpened", "open", "openGood", "openBad", "font", "rock", "question", "question_color", "hover", "hover_light", "hover_dark", "bevel_light", "bevel_dark"],
              style = getComputedStyle(document.body);
  
        for(let i = 0; i < vars.length; i++)
          this.style[vars[i]] = style.getPropertyValue("--cell-" + vars[i]);

        for(let i = 0; i < 9; i++)
          this.style[i] = style.getPropertyValue("--cell-" + i);

        console.log(this.style);
      }
  
      static init()
      {
        return EL.table ? new this() : null;
      }
  
      draw(index = -1)
      {
        for(let i = 0; i < this.tableSorted.draw.length; i++)
        {
          this.drawCell({index: this.tableSorted.draw[i], hover: this.tableSorted.draw[i] == index});
        }
        if (this.isFinished == LOOSE)
        {
          this.drawCell({index: this.tableSorted.draw[0]});
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
          if (list[i] > -1) this.drawCell({index: list[i]});
        }
      
      }
  
      showCell({index = 1, hover = false, ctx = this.ctx, around = false, shown = new Map(), table = SETTINGS.table})
      {
        if (around)
        {
          for(let i = 0; i < OFFSET.length; i += 2)
          {
            const ai = getIndexOffset(index, OFFSET[i], OFFSET[i + 1]);
            if (shown.has(ai))
              continue;
            this.drawCell({index: ai, ctx, hover, table});
            shown.set(ai, '');
// console.log(ai);
          }

        }
// console.trace({...this.cell(index)})
        if (!shown.has(index))
          this.drawCell({index, hover, ctx, table});

        shown.set(index, "");
      }
      drawCell({index = -1, hover = false, ctx = this.ctx, preview = false, table = SETTINGS.table})
      {
        if (index < 0)
          return;

        const cell = this.cell(index, table);
if (!index)
console.trace(index, cell.isOpen);
        if (preview)
          cell.isOpen = false;

        if (hover && (cell.isRock))
          return;
// console.log(cell, hover && (cell.isRock || cell.isVis));
        let {x, y, type} = cell,
            size = this.cellSize;
  
        // if (cell.isFlag)
        // {
        //   x -= 1;
        //   y -= 1;
        //     size += 1;
        // }
        // x++;
        // y++;
        ctx.clearRect(x, y, size,size);
        ctx.fillStyle = this.style.fill;
        ctx.fillRect(x, y, size, size);

        ctx.strokeStyle = this.style.stroke;
        ctx.lineWidth = 1;
        // ctx.fillStyle = cell.isOpen ? this.style.open : this.style.fill;
        ctx.fillStyle = hover && !(cell.isVis || this.isFinished) ? this.style.hover : this.style.fill;
        if (this.isFinished)
        {
          ctx.fillStyle = cell.isShow ? this.style.fill : (this.isFinished == WIN ? this.style.openGood : this.style.fill);
          let p = -1;
          while ((p = this.steps.indexOf(index, p+1)) > -1)
            cell.step[cell.step.length] = p + 1;
        }
  
        if (!hover)
          {if (cell.isRock)
            ctx.fillStyle = this.style.rock;
          else if (cell.isFlag)
            ctx.fillStyle = this.style.flag;
          else if (cell.isQuestion)
            ctx.fillStyle = this.style.question;
          else if (cell.isMine && this.isFinished)
            ctx.fillStyle = cell.isOpen ? this.style.mineOpened : this.style.fill;
        }
        // if (cell.isShake && save)
        // {
        //   this.savedCell = ctx.getImageData(x, y, size, size);
        // }
        // ctx.save();
        // if (cell.isFlag)
        // {
        //   // x += 1;
        //   // y += 1;
        //   // size -= 1;
        //   // ctx.shadowBlur = this.shadowSize/1.5;
        //   // ctx.shadowOffsetY = this.shadowSize;
        //   // ctx.shadowOffsetX = this.shadowSize;
        //   // ctx.shadowColor = "#000";
        // }
        // if (cell.isShake && this.savedCell)
        //   ctx.putImageData(this.savedCell, x, y);
        // else
// console.log(index, cell.isShow, cell)
          ctx.fillRect(x, y, size, size);
          
          // let bev = Math.min(this.cellSize / (hover ? 20 : 3), 8);
          let bev = Math.min(this.cellSize / 4, 10);
          if (!cell.isVis || (cell.isFlag || (!cell.isOpen && (!this.isFinished || (isFinished && !cell.isMine)))))
          {
            ctx.save();
            let borders = cell.borders;
            let _x = 0, _y = 0, _w = 0, _h = 0;
            if (hover && !(cell.isVis || this.isFinished))
            {
              if (borders[W])
                _x = bev;
              if (borders[E])
                _w = bev;
              if (borders[N])
                _y = bev;
              if (borders[S])
                _h = bev;
              ctx.fillStyle = this.style.hover;
              ctx.fillRect(x+_x,y+_y,size-_w-_x,size-_h-_y);
            }
            for(let i = 0; i < bev; i+=1)
            {
              const offset = i,
                    alpha = (~~(((bev -i) / bev) * 255)).toString(16).padStart(2,0),
                    light = (this.style.bevel_light) + alpha,//"rgba(255,255,255," + (bev -i) / bev + ")",
                    dark = (this.style.bevel_dark) + alpha;//"rgba(0,0,0," + (bev-i) / bev + ")";

                    ctx.strokeStyle = light;
              if (borders[W])
              {
                let top = borders[N] ? offset : 0,
                    bottom = borders[S] ? offset : 0;
                ctx.beginPath();
                ctx.moveTo(x+offset,y+size-bottom);
                ctx.lineTo(x+offset,y+top);
                ctx.stroke();
                ctx.closePath();
              }
              if (borders[N])
              {
                let right = borders[E] ? offset : 0,
                    left = borders[W] ? offset : 0;

                // if (!borders[LEFT])
                ctx.beginPath();
                ctx.moveTo(x+left,y+offset);
                ctx.lineTo(x+size-right,y+offset);
                ctx.stroke();
              }
              else
              {
                let stroke = ctx.strokeStyle;
                if (borders[NE] && !borders[E])
                {
                  ctx.beginPath();
                  ctx.strokeStyle = light;
                  ctx.moveTo(x+size,y+offset);
                  ctx.lineTo(x+size-offset/2,y+offset/2);
                  ctx.stroke();

                  ctx.beginPath();
                  ctx.strokeStyle = dark;
                  ctx.moveTo(x+size-offset,y);
                  ctx.lineTo(x+size-offset/2,y+offset/2);
                  ctx.stroke();
                }
                if (borders[NW] && !borders[W])
                {
                  ctx.beginPath();
                  ctx.strokeStyle = light;
                  ctx.moveTo(x,y+offset);
                  ctx.lineTo(x+offset/2,y+offset/2);
                  ctx.moveTo(x+offset/2,y+bev-(bev -offset/2));
                  ctx.lineTo(x+offset,y);
                  ctx.stroke();
                }
                ctx.strokeStyle = stroke;
              }
      
              ctx.strokeStyle = dark;
              if (borders[S])
              {
                let right = borders[E] ? offset : 0,
                    left = borders[W] ? offset : 0;
                ctx.beginPath();
                ctx.moveTo(x+left,y+size-offset);
                ctx.lineTo(x+size-right,y+size-offset);
                ctx.stroke();
              }
              else
              {
                let stroke = ctx.strokeStyle;
                if (borders[SE] && !borders[E])
                {
                  ctx.beginPath();
                  ctx.strokeStyle = dark;
                  ctx.moveTo(x+size,y+size-offset);
                  ctx.lineTo(x+size-offset/2,y+size-offset/2);
                  ctx.moveTo(x+size-offset/2,y+size-offset/2);
                  ctx.lineTo(x+size-offset,y+size);
                  ctx.stroke();
                }
                if (borders[SW] && !borders[W])
                {
                  ctx.beginPath();
                  ctx.strokeStyle = dark;
                  ctx.moveTo(x,y+size-offset);
                  ctx.lineTo(x+offset/2,y+size-offset/2);
                  ctx.stroke();

                  ctx.beginPath();
                  ctx.strokeStyle = light;
                  ctx.moveTo(x+offset/2,y+size-offset/2);
                  ctx.lineTo(x+offset,y+size);
                  ctx.stroke();
                }
                ctx.strokeStyle = stroke;
              }
              if (borders[E])
              {
                let top = borders[N] ? offset : 0,
                    bottom = borders[S] ? offset : 0;
                // if (!borders[BOTTOM])
                ctx.beginPath();
                ctx.moveTo(x+size-offset,y+size-bottom);
                ctx.lineTo(x+size-offset,y+top);
                ctx.stroke();
              }
            }
            ctx.restore();
          }
          // 6) Draw stencil with shadow but only on non-transparent pixels
          // ctx.globalCompositeOperation = "source-atop";
          // ctx.fill();
    
        // ctx.restore();
        const callback = () =>
        {
          if (cell.step)
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
          ctx.strokeStyle = this.style.stroke;
          ctx.strokeRect(x, y, size, size);
        }; //callback
        let finish = false;
        
        if (cell.isFlag)
          this.drawImg({name: "flag" + (this.isFinished ? cell.isMine  ? "Good" : "Bad" : ""), x, y, size, callback});
        else if (cell.isQuestion && (!this.isFinished || (this.isFinished && !cell.isMine)))
        {
          finish = true;
          ctx.fillStyle = this.style.question_color;
          ctx.fillText("?",  x + Math.round(size/2)+0.0, y + Math.round(size /2)+~~(this.textSize / 10) - 0.5);
          // this.drawImg({name: "question", x, y, size, callback, rotate:180});
        }
        else if (cell.isMine && this.isFinished)
        {
          let offsetX = 0, offsetY = 0, rotate = 0;
          if (cell.isShake)
          {
            offsetX = ~~(Math.random() * size  - size /2) / 20;
            offsetY = ~~(Math.random() * size  - size /2) / 20;
            rotate = Math.random() * 10;
          }
          this.drawImg({name: "mine", x, y, size, offsetX, offsetY, rotate, callback});
        }
        else if (cell.type && cell.isVis)
        {
          ctx.fillStyle = cell.style.color;

// const obj = {}
// for(let i in ctx)
// {
//   if (typeof ctx[i] != "function")
//   obj[i] = ctx[i];
// }
          ctx.fillText(type, x + Math.round(size/2)+0.0, y + Math.round(size /2)+~~(this.textSize / 10) - 0.5);
          finish = true;
        }
        else
          finish = true;

        if (finish)
        {
          callback();
        }

        return cell;
      }
  
      drawImg({name, x, y, size, offsetX = 0, offsetY = 0, rotate = 0, callback = () => {}})
      {
        this.images[name].then(img => 
        {
          this.ctx.save();
          this.ctx.fillStyle = this.style.fill;
          // this.ctx.globalCompositeOperation = "source-atop";
          // this.ctx.shadowBlur = this.shadowSize/1.5;
          // this.ctx.shadowColor = "#FFFFFF0F";
          const tx = x+size/2,
                ty = y+size/2;

          this.ctx.translate(tx,ty);
          this.ctx.rotate(rotate* Math.PI / 180);
          this.ctx.translate(-tx,-ty);
          this.ctx.drawImage(img, x+offsetX+size/9, y+offsetY+size/9, size-size/4.5, size-size/4.5);
          this.ctx.restore();
          callback();
        }).catch(console.error)
          .finally(callback);
      }
  
      cell(index, table = SETTINGS.table)
      {
        const that = this,
              {x, y} = indexToXY(index),
              value = table[index],
              type = value & TYPE,
              isMine = type == MINE,
              isRock = type == ROCK,
              isOpen = value & OPEN,
              isShow = value & SHOW || this.isFinished && !isOpen;
        return {
          index,
          x: x * this.cellSize + 0.5,
          y: y * this.cellSize + 0.5,
          value,
          type,
          isMine,
          isRock,
          isOpen,
          isShow,
          isEmpty: !type,
          isFlag: value & FLAG,
          isQuestion: value & QUESTION,
          isVis: value & (SHOW + OPEN),
          status: value & (OPEN + FLAG + SHOW),
          isShake: type == MINE && value & OPEN,
          size: this.getTextBox(type),
          style: {
            background: this.style[isRock ? "rock" : isOpen ? "open" + isMine ? "Bad": "Good" : isShow ? "openBad" : "fill"],
            get color() {return SETTINGS.monochrome ? that.style.stroke : that.style[type];},
          },
          step: [],
          borders: getBorders(index)
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
        // x += offsetX-0.5;
        // y += offsetY-0.5;
        if (x < 0 || x > this.width-1 || y < 0 || y > this.height-1)
          return -1;
      
        return y * this.width + x;
      }


      onClick(e)
      {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (gameStatus || dragScroll || SETTINGS.stats.pauseTime || (e.type == "auxclick" && e.button == 2))
          return;
    
        const index = this.eventToIndex(e),
              leftClick = e.type == "click",
              table = SETTINGS.table,
              val = table[index],
              type = val & TYPE;
        if (index < 0 || type == ROCK || (leftClick && (val & OPEN || val & FLAG || val & SHOW)) || (!leftClick && val & OPEN) || (!leftClick && !SETTINGS.stats.start))
          return;
console.log("onClick");
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
          if (type == MINE)
          {
            SETTINGS.stats.time = new Date().getTime() - SETTINGS.stats.start;
            anim.explode.timer = anim.explode.duration+1;
console.log(anim.explode)
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
          if (SETTINGS.questionMark)
          {
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
          }
          else
          {
            table[index] &= ~QUESTION;
            table[index] ^= FLAG;
          }
    
          audio("flag" + (type & FLAG ? "" : "off"));
    
          SETTINGS.stats.mines += val & FLAG ? -1 : val & QUESTION ? 0 : 1;
          board.showCell({index, hover: true});
        }

        if (isWon())
        {
          SETTINGS.stats.time = new Date().getTime() - SETTINGS.stats.start;
          audio(SETTINGS.stats.steps.length == perfect.val ? "perfect" : "win");
          saveStats(1);
          finished(true);
        }
        else
        {
          // board.update(index);
          // board.drawCell({index});
        }
      
        SETTINGS.save();
      }

      get width() { return this.canvas.width;}
      set width(size){
        this.canvas.width = size;
        this.ctx.width = size;
      }
      get height() { return this.canvas.height;}
      set height(size){
        this.canvas.height = size;
        this.ctx.height = size;
      }
    };
  }

}
