// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const {dialog} = require('electron').remote;
window.$ = window.jQuery = require('jquery');
const path = require('path');
const swal = require('sweetalert2');
$(".psd_file_zone").on("dragover", function (e) {
    e.preventDefault();
});
$(".psd_file_zone").on("drop", function (e) {
    e.preventDefault();
    let file_path = e.originalEvent.dataTransfer.files[0].path;
    let file_path_parse = path.parse(file_path);
    if (file_path_parse.ext.toLowerCase() !== '.psd' && file_path_parse.ext.toLowerCase() !== '.json') {
        swal.fire({
            title: '提示',
            text: '请选择整理好的PSD文件或由本工具生成的JSON文件!',
            type: 'info',
            confirmButtonText: '确定'
        });
        return false;
    }
    location.href = '../edit/edit.html?file=' + encodeURIComponent(file_path);
});

$(".psd_file_zone").click(function () {
    dialog.showOpenDialog({
        filters: [
            {name: 'H5Auto', extensions: ['Psd','json']}
        ], properties: ['openFile']
    }, function (e) {
        if (!e) {
            return false;
        }
        let file_path = e[0];
        let file_path_parse = path.parse(file_path);
        if (file_path_parse.ext.toLowerCase() !== '.psd' && file_path_parse.ext.toLowerCase() !== '.json') {
            swal.fire({
                title: '提示',
                text: '请选择整理好的PSD文件或由本工具生成的JSON文件!',
                type: 'info',
                confirmButtonText: '确定'
            });
            return false;
        }
        location.href = '../edit/edit.html?file=' + encodeURIComponent(file_path);
    });
})