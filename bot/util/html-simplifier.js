/**
 * Created by dodo on 2017. 8. 11..
 */
const striptags = require('striptags');
exports.simplify = function (html) {
    return striptags(html, [], "\n").replace(/\n[ \t]+/g, "\n").replace(/[\r\n]+/g, "\n")
};