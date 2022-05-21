(function(){
    var LyricsItem = function(text){
        var that = this;
        that.text = text;
        that.index = 0;
        that.position_index = 0;
    };
    LyricsItem.prototype = {
        constructor: LyricsItem,
        toPosition: async function(to_index, duration){
            var fps = 16; //fps: 設愈大愈流暢，但愈吃效能
            var step_ms = 1000 / fps;
            var tick = Math.ceil(duration / step_ms);
            var that = this;
            var from_index = that.index;
            that.index = to_index;
            for(var i = 1; i <= tick; i++){
                await new Promise(function(r){setTimeout(r, step_ms)});
                that.position_index = from_index + (to_index - from_index)*(i/tick);
                if(that.index != to_index) return;
            }
            that.position_index = to_index;
        },
        draw: function(opts){
            var that = this;
            var ctx = opts.ctx;
            var width = opts.width;
            var height = opts.height;
            var font_size = opts.font_size;
            var line_height = opts.line_height;
            var box = ctx.measureText(that.text);
            var toAlpha = function(a){
                if(a > 1) a = 1;
                if(a < 0) a = 0;
                return a;
            };
            //{ width: 70, actualBoundingBoxLeft: -0.234375, actualBoundingBoxRight: 69.677734375, actualBoundingBoxAscent: 7.65625, actualBoundingBoxDescent: 1.669921875 }
            ctx.save();
            var actual_width = box.actualBoundingBoxRight - box.actualBoundingBoxLeft;
            if(actual_width > width) {
                var new_font_size = font_size * width / actual_width;
                ctx.font = new_font_size+"px Noto Sans TC, Helvetica Neue, Helvetica, Arial, PingFang TC, Heiti TC, 微軟正黑體, Malgun Gothic, sans-serif";
                box = ctx.measureText(that.text);
                actual_width = box.actualBoundingBoxRight - box.actualBoundingBoxLeft;
            }
            ctx.globalAlpha= toAlpha(1 - Math.abs(that.position_index)/1.5);
            ctx.translate(actual_width/-2, line_height*font_size*(that.position_index + 1/2));
            ctx.shadowColor='rgba(255,255,200,'+toAlpha(1 - Math.abs(that.position_index)/1)+')';
            ctx.shadowBlur=8;
            ctx.lineWidth=2;
            ctx.strokeText(that.text, width/2, height/2);
            ctx.shadowBlur=0;
            ctx.fillStyle="white";
            ctx.fillText(that.text, width/2, height/2);
            ctx.restore();
        }
    };
    var LyricsBoard = function(parentNode, opts){
        var that = this;
        that.canvas = document.createElement('canvas');
        that.video = document.createElement('video');
        that.video.style = "width: 24px;height: 24px;background: black;";
        that.video.width = that.canvas.width = opts.width || 800;
        that.video.height = that.canvas.height = opts.height || 200;
        parentNode.appendChild(that.video);

        that.font_size = opts.font_size || 24;
        that.ctx = that.canvas.getContext('2d');
        that.lyrics_list = [];
        that.current_focus_index = null;
        that.render();
        that.video.srcObject = that.canvas.captureStream();
        that.video.play();
    };
    LyricsBoard.prototype = {
        constructor: LyricsBoard,
        addLyrics: function(text, index){
            var that = this;
            var lyrics = new LyricsItem(text);
            if(index === undefined) {
                lyrics.position_index = lyrics.index = that.lyrics_list.reduce(function(s,d,i){
                    if(s === null || d.index > s) {
                        s = d.index;
                    }
                    return s;
                }, -1)+1;
            } else {
                lyrics.position_index = lyrics.index = index;
            }
            that.lyrics_list.push(lyrics);
        },
        focusLyrics: function(line_index){
            var that = this;
            if(line_index == that.current_focus_index) return;
            that.current_focus_index = line_index;
            that.lyrics_list.forEach(function(lyrics, i){
                lyrics.toPosition(i - line_index, 300);
            });
        },
        render: function(){
            var that = this;
            var canvas = that.canvas;
            var ctx = that.ctx;
            ctx.clearRect(0,0,canvas.width,canvas.height);
            ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.font = that.font_size+"px Noto Sans TC, Helvetica Neue, Helvetica, Arial, PingFang TC, Heiti TC, 微軟正黑體, Malgun Gothic, sans-serif";
            that.lyrics_list.forEach(function(lyrics, i){
                if(Math.abs(i - that.current_focus_index) <= 3) {
                    lyrics.draw({
                        ctx: ctx, width: canvas.width, height: canvas.height, font_size: parseInt(ctx.font), line_height: 1.2
                    });
                }
            });
            requestAnimationFrame(function(){
                that.render();
            });
        },
        attachKKBOX: function(){
            var that = this;
            var lines = document.querySelectorAll('[data-lyrics-line]');
            var song_name = document.querySelectorAll('[href^="/track/"][title]')[0].textContent;
            var checkEmpty = (function(){
                var timer = null;
                return function(){
                    clearTimeout(timer);
                    timer = setTimeout(function(){
                        var has_focus = false;
                        var nearst_empty = null;
                        lines.forEach(function(line, i){
                            if(line.getAttribute('class').split(' ').length > 1) {
                                has_focus = true;
                            }
                            if(line.textContent == '' && i >= that.current_focus_index-2 && nearst_empty === null && that.current_focus_index > 5 && i > 5) {
                                nearst_empty = i + 1;
                            }
                        });
                        if(!has_focus && nearst_empty) {
                            that.focusLyrics(nearst_empty);
                        }
                    }, 300);
                };
            })();
            that.lyrics_change = new MutationObserver(function (mutations) {
                mutations.forEach(function(m){
                    var line = m.target;
                    if(m && m.type == 'attributes' && line.getAttribute('class').split(' ').length > 1) {
                        focus = line.getAttribute('data-lyrics-line')*1;
                        that.focusLyrics(focus+1);
                    }
                });
                if(mutations.length == 1){
                    checkEmpty();
                }
            });
            that.song_change = new MutationObserver(function (mutations) {
                that.clearLyrics();
                setTimeout(function(){
                    that.attachKKBOX();
                }, 1000);
            });

            that.current_focus_index = null;
            that.addLyrics(song_name);
            lines.forEach(function(line){
                that.addLyrics(line.textContent);
                that.lyrics_change.observe(line, {attributes: true});
            });
            that.song_change.observe(document.querySelectorAll('[href^="/track/"][title]')[0], {
                attributes: true
            });
        },
        clearLyrics: function(){
            var that = this;
            that.lyrics_list = [];
            that.lyrics_change.disconnect();
        },
        destroy: function(){
            var that = this;
            that.video.parentNode.removeChild(that.video);
            that.lyrics_change.disconnect();
            that.song_change.disconnect();
        }
    };
    if(window.lyricsBoard) {
        lyricsBoard.destroy();
    }
    window.lyricsBoard = new LyricsBoard(document.querySelector('.k-icon-now_playing-expand').parentNode,{
        width: 800, height: 200,
        font_size: 48
    });
    lyricsBoard.attachKKBOX();
})();
