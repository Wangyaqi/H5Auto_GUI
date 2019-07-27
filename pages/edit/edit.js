// edit.js
const {dialog, shell, getCurrentWindow} = require('electron').remote;
window.$ = window.jQuery = require('jquery');
const path = require('path');
const fs = require('fs');
const PSD = require('psd');
const Vue = require('../../node_modules/vue/dist/vue.common.js');
const html2canvas = require('html2canvas');
const swal = require('sweetalert2');
const mousetrap = require('mousetrap');

const postcss = require('postcss');
const postcssJs = require('postcss-js');
const autoprefixer = require('autoprefixer');

const prefixer = postcssJs.sync([autoprefixer]);

const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');

function init() {
    let search_arr = location.search.substring(1, location.search.length).split('&');
    let search_obj = {};
    search_arr.forEach((item) => {
        let item_split = item.split('=');
        search_obj[item_split[0]] = decodeURIComponent(item_split[1]);
    });
    let file_path = search_obj.file;
    let file_path_parse = path.parse(file_path);
    if (file_path_parse.ext.toLowerCase() === '.psd') {
        psd_handler(file_path);
    } else if (file_path_parse.ext.toLowerCase() === '.json') {
        json_handler(file_path);
    } else {
        history.back();
        return false;
    }
}

init();

function psd_handler(psdfile) {
    swal.fire({
        title: '处理中...',
        text: '正在处理PSD文件可能耗费较长时间，请稍后',
        confirmButtonText: '完成自动关闭',
        onBeforeOpen: () => {
            swal.showLoading()
        }
    });
    let psd = PSD.fromFile(psdfile);
    psd.parse();
    let psd_tree = psd.tree(),
        psd_tree_exp = psd_tree.export();
    let h5auto_obj = {},
        output_path = "";
    h5auto_obj.d_width = psd_tree_exp.document.width;
    h5auto_obj.d_height = psd_tree_exp.document.height;
    h5auto_obj.uni_bg = "";
    h5auto_obj.title = "项目标题"
    h5auto_obj.page_list = [];

    let page_index = 0;//page_1对应page_index为1
    let page_total = psd_tree_exp.children.length;

    function root_layerset_handler(tree_exp, tree) {
        for (let i = tree_exp.children.length - 1; i >= 0; i--) {
            let tree_exp_child = tree_exp.children[i],
                tree_child = tree.children()[i];
            if (tree_exp_child.name.toLowerCase() === "bg") {
                h5auto_obj.uni_bg = "bg";
                tree_child.saveAsPng(path.resolve(output_path, "img/bg.png"));
            } else {
                page_index++;
                h5auto_obj.page_list.push({
                    page_index: page_index,
                    bg: "",
                    mode: ""
                });
                build_page(tree_exp_child, tree_child, page_index);
            }
        }
        setTimeout(function () {
            swal.close();
            load_project(h5auto_obj, output_path);
        }, 1000);
    }

    function build_page(tree_exp, tree, page_index) {
        for (let i = tree_exp.children.length - 1; i >= 0; i--) {
            let tree_exp_child = tree_exp.children[i],
                tree_child = tree.children()[i];
            if (tree_exp_child.name.toLowerCase() === "bg") {
                h5auto_obj.page_list[page_index - 1].bg = "bg_" + page_index;
                tree_child.saveAsPng(path.resolve(output_path, "img/bg_" + page_index + ".png"));
            }
        }
        h5auto_obj.page_list[page_index - 1].element = build_group(tree_exp, tree, "p_" + page_index);
        swal.update({
            title: '处理中...(' + page_index + '/' + page_total + ')',
            text: '正在处理PSD文件可能耗费较长时间，请稍后',
            confirmButtonText: '完成自动关闭'
        });
    }

    function build_group(tree_exp, tree, group_index) {
        let group_obj = {id: group_index, type: "group", children: []};
        for (let i = tree_exp.children.length - 1; i >= 0; i--) {
            let tree_exp_child = tree_exp.children[i],
                tree_child = tree.children()[i];
            if (tree_exp_child.name.toLowerCase() === "bg") {
            } else if (tree_exp_child.type === "group") {
                group_obj.children.push(build_group(tree_exp_child, tree_child, group_index + "_" + i));
            } else if (tree_exp_child.text) {
                group_obj.children.push({
                    id: group_index + "_" + i,
                    type: "text",
                    left: tree_exp_child.left,
                    top: tree_exp_child.top,
                    width: tree_exp_child.width,
                    height: tree_exp_child.height,
                    fontSize: tree_exp_child.text.font.sizes[0],
                    lineHeight: tree_exp_child.text.font.sizes[0],
                    color: tree_exp_child.text.font.colors[0],
                    alignment: tree_exp_child.text.font.alignment[0],
                    content: "<p>" + tree_exp_child.text.value.replace(/\r/g, "&nbsp;</p><p>") + "</p>",
                    animate: 0,
                    hide: 0,
                    animation: [{
                        name: "bounceIn",
                        duration: 1,
                        delay: 0,
                        repeat: 1,
                        is_alternate: 0,
                        is_forwards: 1,
                    }]
                });
            } else {
                group_obj.children.push({
                    id: group_index + "_" + i,
                    type: "img",
                    left: tree_exp_child.left,
                    top: tree_exp_child.top,
                    width: tree_exp_child.width,
                    height: tree_exp_child.height,
                    animate: 0,
                    hide: 0,
                    animation: [{
                        name: "bounceIn",
                        duration: 1,
                        delay: 0,
                        repeat: 1,
                        is_alternate: 0,
                        is_forwards: 1,
                    }]
                });
                tree_child.saveAsPng(path.resolve(output_path, "img/" + group_index + "_" + i + ".png"));
            }
        }
        return group_obj;
    }

    dialog.showOpenDialog({
        title: "请选择输出目录",
        properties: ['openDirectory']
    }, (e) => {
        if (!e) {
            history.back();
            return false;
        }
        output_path = e[0];

        let template_dir = path.resolve(__dirname, "../../template");
        copy_dir(template_dir, output_path);
        root_layerset_handler(psd_tree_exp, psd_tree);
    });
}

function copy_dir(src_dir, dest_dir) {
    let files = fs.readdirSync(src_dir, {withFileTypes: true});
    files.forEach(function (file) {
        let src_file = path.resolve(src_dir, file.name),
            dest_file = path.resolve(dest_dir, file.name);
        if (file.isFile()) {
            fs.copyFileSync(src_file, dest_file);
        } else if (file.isDirectory()) {
            try {
                fs.accessSync(dest_file);
            } catch (e) {
                fs.mkdirSync(dest_file);
            }
            copy_dir(src_file, dest_file);
        }
    })
}


function json_handler(jsonfile) {
    let output_path = path.parse(jsonfile).dir;
    fs.readFile(jsonfile, 'utf8', (err, data) => {
        if (err) {
            throw err;
        }
        let h5auto_obj = JSON.parse(data);
        load_project(h5auto_obj, output_path);
    });
}

let global_h5auto_obj = {},
    global_output_path = "";

function load_project(h5auto_obj, output_path) {
    global_h5auto_obj = JSON.parse(JSON.stringify(h5auto_obj));
    global_output_path = output_path;
    show_project();
    save();
}

let save_arr = [];

function save() {
    let current_obj_str = JSON.stringify(global_h5auto_obj);
    if (current_obj_str === save_arr[save_arr.length - 1]) {
        return false;
    }
    save_arr.push(current_obj_str);
    fs.writeFile(path.resolve(global_output_path, 'H5Auto.json'), current_obj_str, 'utf8', (err) => {
        if (err) throw err;
    });
}

function restore() {
    if (save_arr.length <= 1) {
        return false;
    }
    save_arr.pop();
    global_h5auto_obj = JSON.parse(save_arr[save_arr.length - 1]);
    show_project();
}

let page_group = Vue.component("pagegroup", {
    template: "#pagegroup",
    data: function () {
        return {}
    },
    props: ['layers', 'current_layer_id'],
    methods: {
        get_src: function (img_name) {
            //此处为解决背景图问题将\替换为/
            return path.resolve(global_output_path, 'img/' + img_name + '.png').replace(/\\/g, "/");
        },
        get_color: function (color_arr) {
            return 'rgba(' + color_arr[0] + ',' + color_arr[1] + ',' + color_arr[2] + ',' + color_arr[3] + ')'
        },
        set_current_layer_index: function (index) {
            edit_app.current_layer_index = index;
        },
        set_content: function (item) {
            item.content = event.target.innerHTML;
        },
        build_style: function (item) {
            let result = get_style_from_layer(item);
            Object.assign(result, get_animation_from_layer(item));
            return result;
        }
    }
})

function get_color(color_arr) {
    return 'rgba(' + color_arr[0] + ',' + color_arr[1] + ',' + color_arr[2] + ',' + color_arr[3] + ')'
}

function get_style_from_layer(item) {
    let result = {};
    if (item.type === "img") {
        result = {
            left: item.left + 'px',
            top: item.top + 'px',
            width: item.width + 'px',
            height: item.height + 'px'
        }
    } else if (item.type === "text") {
        result = {
            left: item.left + 'px',
            top: item.top + 'px',
            width: item.width + 'px',
            height: item.height + 'px',
            fontSize: item.fontSize + 'px',
            lineHeight: item.lineHeight + 'px',
            textAlign: item.alignment,
            color: get_color(item.color)
        }
    }
    return result;
}

function get_animation_from_layer(layer) {
    if (layer.animate === 0) {
        return {}
    }
    let result = {
        animationName: '',
        animationDuration: '',
        animationDelay: '',
        animationIterationCount: '',
        animationDirection: '',
        animationFillMode: ''
    };
    if (layer.hide === 1) {
        result.opacity = 0;
    }
    let animation_group = {
        animationName: [],
        animationDuration: [],
        animationDelay: [],
        animationIterationCount: [],
        animationDirection: [],
        animationFillMode: []
    }
    for (let i = 0; i < layer.animation.length; i++) {
        let animation_item = layer.animation[i];
        animation_group.animationName.push(animation_item.name);
        animation_group.animationDuration.push(animation_item.duration + 's');
        animation_group.animationDelay.push(animation_item.delay + 's');
        animation_group.animationIterationCount.push(animation_item.animationIterationCount === 0 ? 'infinite' : animation_item.animationIterationCount);
        animation_group.animationDirection.push(animation_item.is_alternate === 0 ? '' : 'alternate');
        animation_group.animationFillMode.push(animation_item.is_forwards === 0 ? '' : 'forwards');
    }
    Object.keys(animation_group).forEach(function (key) {
        result[key] = animation_group[key].join(',')
    });
    return result;
}

let edit_app = new Vue({
    el: "#edit_app",
    data: {
        h5auto_obj: null,
        current_page_index: 0,
        current_layer_index: 0,
        show_scale: 0.5,
        page_thumb: []
    },
    computed: {
        flat_layers: function () {
            if (!this.h5auto_obj) {
                return [];
            }
            let ele_tree = this.h5auto_obj.page_list[this.current_page_index].element;
            return flat_ele_tree(ele_tree)
        },
        current_page: function () {
            if (!this.h5auto_obj) {
                return {};
            }
            return this.h5auto_obj.page_list[this.current_page_index];
        },
        current_layer: function () {
            if (!this.h5auto_obj) {
                return {};
            }
            return this.flat_layers[this.current_layer_index];
        },
        current_layer_id: function () {
            return this.current_layer.id;
        },
        current_page_bg: function () {
            if (!this.h5auto_obj) {
                return '';
            }
            let page_bg = this.h5auto_obj.page_list[this.current_page_index].bg,
                uni_bg = this.h5auto_obj.uni_bg;
            if (page_bg !== '') {
                return this.get_src(page_bg)
            } else if (uni_bg !== '') {
                return this.get_src(uni_bg)
            } else {
                return '';
            }
        }
    },
    methods: {
        init: function () {
            for (let i = this.page_thumb.length; i < this.h5auto_obj.page_list.length; i++) {
                this.page_thumb.push('');
            }
        },
        set_current_page_index: function (index) {
            this.current_page_index = index;
        },
        set_current_layer_index: function (index) {
            this.current_layer_index = index;
        },
        get_src: function (img_name) {
            //此处为解决背景图问题将\替换为/
            return path.resolve(global_output_path, 'img/' + img_name + '.png').replace(/\\/g, "/");
        },
        delete_page: function (page_index) {
            if (this.flat_layers.length <= 1) {
                return false;
            }
            swal.fire({
                title: '确定删除此页面吗？',
                text: '此操作不会删除图片资源!',
                type: 'warning',
                showCancelButton: true,
                confirmButtonText: '确定删除',
                cancelButtonText: '取消删除'
            }).then((result) => {
                if (result.value) {
                    if (this.h5auto_obj.page_list.length <= 1) {
                        return false;
                    }
                    this.h5auto_obj.page_list.splice(page_index, 1);
                    this.page_thumb.splice(page_index, 1);
                    if (page_index === this.current_page_index) {
                        this.current_page_index = 0;
                    }
                    save();
                }
            })
        },
        delete_layer: function (layer, layer_index) {
            let current_tree = this.h5auto_obj.page_list[this.current_page_index].element;

            function search(current_tree) {
                if (current_tree.hasOwnProperty("children")) {
                    if (current_tree.children.indexOf(layer) > -1) {
                        current_tree.children.splice(current_tree.children.indexOf(layer), 1);
                    } else {
                        for (let i = 0; i < current_tree.children.length; i++) {
                            search(current_tree.children[i]);
                        }
                    }
                }
            }

            search(current_tree);

            if (layer_index === this.current_layer_index) {
                this.current_layer_index = 0;
            }

            save();
        },
        add_animation: function () {
            this.current_layer.animation.push({
                name: "bounceIn",
                duration: 1,
                delay: 0,
                repeat: 1,
                is_alternate: 0,
                is_forwards: 1,
                hide: 0,
            });
            save();
        },
        remove_animation: function (animation_item) {
            let animation = this.current_layer.animation;
            if (animation.length <= 1) {
                this.current_layer.animate = 0;
            } else {
                animation.splice(animation.indexOf(animation_item), 1);
            }
            save();
        },
        change_attr: function () {
            save();
        },
        save_h5auto_obj: function () {
            save();
            swal.fire({
                title: '保存成功',
                text: '',
                type: 'success',
                confirmButtonText: '确定'
            })
        },
        restore_h5auto_obj: function () {
            restore();
        },
        play: function () {
            $(".page_show_view").children().hide();
            setTimeout(function () {
                $(".page_show_view").children().show();
            }, 1);
        },
        publish: function () {
            publish();
        },
        go_back: function () {
            swal.fire({
                title: '确定退出编辑吗？',
                text: '请务必确保修改已保存!',
                type: 'info',
                showCancelButton: true,
                confirmButtonText: '确定',
                cancelButtonText: '取消'
            }).then((result) => {
                if (result.value) {
                    history.back();
                }
            });
        },
        open_url_in_navi: function (url) {
            shell.openExternal(url);
        },
        get_page_thumb: function () {
            if (this.page_thumb.length === 0) {
                for (let i = 0; i < this.h5auto_obj.page_list.length; i++) {
                    this.page_thumb.push('');
                }
            }
            setTimeout(() => {
                html2canvas($(".page_show_view")[0]).then((canvas) => {
                    this.page_thumb[this.current_page_index] = canvas.toDataURL("image/jpeg");
                });
            }, 1);
        }
    },
    watch: {
        current_page_index: function () {
            this.get_page_thumb();
            this.current_layer_index = 0;
        }
    }
})

Mousetrap.bind(['command+s', 'ctrl+s'], () => {
    edit_app.save_h5auto_obj();
    return false
});

Mousetrap.bind(['command+z', 'ctrl+z'], () => {
    edit_app.restore_h5auto_obj();
    return false
});

Mousetrap.bind(['command+f5', 'ctrl+f5'], () => {
    edit_app.play();
    return false
});

Mousetrap.bind(['command+f9', 'ctrl+f9'], () => {
    edit_app.publish();
    return false
});

Mousetrap.bind(['command+f12', 'ctrl+f12'], () => {
    edit_app.go_back();
    return false
});

Mousetrap.bind('up up down down left right left right b a enter', () => {
    getCurrentWindow().webContents.openDevTools();
    setTimeout(function () {
        swal.fire({
            title: '想啥呢？',
            text: '并没有这种操作!',
            type: 'info',
            confirmButtonText: '确定'
        });
    }, 10)
});

function flat_ele_tree(tree) {
    let result = [];
    if (tree.type === "group") {
        for (let i = 0; i < tree.children.length; i++) {
            result = result.concat(flat_ele_tree(tree.children[i]));
        }
    } else {
        result.push(tree);
    }
    return result;
}

function show_project() {
    edit_app.$set(edit_app, "h5auto_obj", global_h5auto_obj);
    edit_app.init();
}

function publish() {
    fs.copyFileSync(path.resolve(__dirname, "../../template/index.html"), path.resolve(global_output_path, 'index.html'));
    fs.copyFileSync(path.resolve(__dirname, "../../template/css/style.css"), path.resolve(global_output_path, 'css/style.css'));
    fs.copyFileSync(path.resolve(__dirname, "../../template/js/script.js"), path.resolve(global_output_path, 'js/script.js'));

    let d_width = global_h5auto_obj.d_width,
        d_height = global_h5auto_obj.d_height,
        d_width_half = global_h5auto_obj.d_width / 2,
        uni_bg = global_h5auto_obj.uni_bg === "" ? "" : "background-image: url(../img/" + global_h5auto_obj.uni_bg + ".png);",
        title = global_h5auto_obj.title;

    let css_obj = {},
        html_main = '';

    for (let i = 0; i < global_h5auto_obj.page_list.length; i++) {
        let page_item = global_h5auto_obj.page_list[i];
        if (page_item.bg !== "") {
            css_obj['.page_' + page_item.page_index] = {
                backgroundImage: 'url(../img/' + page_item.bg + '.png)'
            }
        }
        html_main += ('<div class="page page_' + page_item.page_index + '" id="page_' + page_item.page_index + '"><div class="page_box ' + page_item.mode + '">');
        html_main += build_group(page_item.element);
        html_main += '</div></div>';
    }

    function build_group(ele) {
        let result = '<div class="' + ele.id + '">';
        for (let i = 0; i < ele.children.length; i++) {
            let ele_child = ele.children[i];
            if (ele_child.type === "group") {
                result += build_group(ele_child);
            } else if (ele_child.type === "text") {
                result += ('<div class="' + ele_child.id + '">' + ele_child.content + '</div>');
                css_obj['.' + ele_child.id] = Object.assign(get_style_from_layer(ele_child), get_animation_from_layer(ele_child), {position: 'absolute'});
            } else if (ele_child.type === "img") {
                result += ('<img class="' + ele_child.id + '" src="img/' + ele_child.id + '.png"/>');
                css_obj['.' + ele_child.id] = Object.assign(get_style_from_layer(ele_child), get_animation_from_layer(ele_child), {position: 'absolute'});
            }
        }
        result += '</div>'
        return result;
    }

    let promise_list = [];
    // script.js模版处理
    let script_js_path = path.resolve(global_output_path, 'js/script.js');
    let script_promise = new Promise((resolve, reject) => {
        fs.readFile(script_js_path, 'utf8', function (err, data) {
            if (err) throw err;
            data = data.replace(/{{d_width}}/g, d_width.toString());
            data = data.replace(/{{d_height}}/g, d_height.toString());
            fs.writeFile(script_js_path, data, function () {
                if (err) {
                    reject();
                    throw err
                }
                ;
                resolve();
            })
        });
    });
    promise_list.push(script_promise);
    // index.html模版处理
    let index_html_path = path.resolve(global_output_path, 'index.html');
    let index_promise = new Promise((resolve, reject) => {
        fs.readFile(index_html_path, 'utf8', function (err, data) {
            if (err) throw err;
            data = data.replace(/{{d_width}}/g, d_width.toString());
            data = data.replace(/{{title}}/g, title);
            data = data.replace(/{{html_main}}/g, html_main);
            fs.writeFile(index_html_path, data, function () {
                if (err) {
                    reject();
                    throw err
                }
                ;
                resolve();
            })
        });
    });
    promise_list.push(index_promise);
    // style.css模版处理
    let style_css_path = path.resolve(global_output_path, 'css/style.css');
    let style_promise = new Promise((resolve, reject) => {
        fs.readFile(style_css_path, 'utf8', function (err, data) {
            if (err) throw err;
            data = data.replace(/{{d_width}}/g, d_width.toString());
            data = data.replace(/{{d_width_half}}/g, d_width_half.toString());
            data = data.replace(/{{uni_bg}}/g, uni_bg.toString());
            postcss().process(prefixer(css_obj), {from: undefined, parser: postcssJs}).then((result) => {
                data = data.replace(/{{css_main}}/g, result);
                fs.writeFile(style_css_path, data, function () {
                    if (err) {
                        reject();
                        throw err
                    }
                    ;
                    resolve();
                });
            });
        });
    });
    promise_list.push(style_promise);

    Promise.all(promise_list).then(() => {
        swal.fire({
            title: '发布成功',
            text: '项目已输出至所选输出目录',
            type: 'success',
            confirmButtonText: '确定'
        }).then(() => {
            swal.fire({
                title: '需要为您压缩图片吗？',
                text: '如果您已经压缩过一次请忽略',
                type: 'info',
                showCancelButton: true,
                confirmButtonText: '确定',
                cancelButtonText: '取消'
            }).then((result) => {
                if (result.value) {
                    png_compress();
                }
            });
        });
    }).catch(() => {
        swal.fire({
            title: '发布失败',
            text: '请联系作者，将H5Auto.json发至wangyaqi988@163.com',
            type: 'error',
            confirmButtonText: '确定'
        });
    });

}

function png_compress() {
    swal.fire({
        title: '图片压缩中',
        text: '可能会耗费较长时间',
        type: 'info',
        confirmButtonText: '请稍后。。。'
    });
    (async function () {
        //一个不认反斜线的插件 path.resolve(path.resolve(global_output_path, 'img'), '*.png') 无法识别
        await imagemin([path.resolve(global_output_path, 'img').replace(/\\/g, "/") + '/*.png'], {
            destination: path.resolve(global_output_path, 'img'),
            plugins: [
                imageminPngquant()
            ]
        });
        swal.fire({
            title: '图片压缩完成',
            text: '',
            type: 'info',
            confirmButtonText: '确定'
        });
    })();
}
