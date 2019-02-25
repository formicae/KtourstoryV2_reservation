const Exceptor = require("../exceptor");
const Log = require("../log");
const watcher = require("./gmailWatcher");
const Agency = require("./model/Agency");
const HtmlSimplifier = require("./util/html-simplifier");
const EventEmitter = require("events").EventEmitter;
/**
 * Gmail Watcher Bot
 * 1. Watch Gmail and notify new message to kintranet
 * 2.
 */
(function init() {
    // prep meta
    //watch
    watcher.on(watcher.EVENT, route);
    // check Agency
    // 1. Auto parsing
    // 2. Verfiable but not auto-parsable message
    // 3. Notify New Message
    //convert

})();

/**
 *
 * @param mail {Mail}
 */
function route(mail) {
    //check agency
    Log.log(Log.CONTEXT_MESSAGE_BUILDER.MAIL(mail.messageid, `New Mail Received : ${mail.fromaddress || mail.from}`));
    const agency = Agency.find(mail.fromaddress || mail.from);
    if (!agency)
        return Exceptor.reportWithMail(Exceptor.TYPE.UNKNOWN_AGENCY_MAIL, mail);
    if (!agency.parsable)
        return Exceptor.reportWithMail(Exceptor.TYPE.UNKNOWN_AGENCY_MAIL, mail);
    if (!mail.subject.match(agency.subject))
        return Exceptor.reportWithAgencyMail(Exceptor.TYPE.UNKNOWN_AGENCY_MAIL, agency, mail);

    parse(mail, agency);
}

function prepare() {
    return new Promise((res, rej) => {

    })
}

/**
 *
 * @param mail
 * @param agency {Agency}
 */
function parse(mail, agency) {
    Log.log(Log.CONTEXT_MESSAGE_BUILDER.RESERVATION(mail.messageid, `New Reservation Mail Received : ${agency.alias}`));
    mail = arrangeContent(mail);
    console.log('content',mail.content);
    if (_.isFunction(agency.parsingStrategy)) {
        console.log(agency.parsingStrategy({}, mail))// reservation, mail;
    }
    //check content
    //parse content to reservation
}

/**
 * 메일 본문 정리
 *
 * 정리가 끝나면, html코드가 정리된 단 하나의 메일 본문만 메일이 갖게 된다.
 * @param mail
 * @returns {Mail}
 */
function arrangeContent(mail) {
    "use strict";
    if (mail["content-type"].type.match(/multipart/i)) { // 복합 구조
        mail.content = serializeContent(mail.content, []); // 일렬화
        if (mail.content.length === 1) { // 일렬화된 메일 본문의 길이가 1인 경우
            mail.content.raw_content = mail.content[0].content; // 후차 디버그를 위해 저장
            mail.content = HtmlSimplifier.simplify(mail.content[0].content); // html 태그 정리
        } else { // 여러 본문
            for (let sub of mail.content) { // 모두 html 태그 정리
                sub.raw_content = sub.content;
                sub.content = HtmlSimplifier.simplify(sub.content);
                if (sub["content-type"].type.match(/text\/html/i)) {
                    sub.date = mail.date;
                    sub.time = mail.time;
                    return sub;
                }
            }
            mail.content[0].date = mail.date;
            mail.content[0].time = mail.time;
            return mail.content[0]; // 0번째 메일만 반환
        }
    } else if (mail["content-type"].type.match(/text/i)) { // 텍스트만 온경우
        mail.raw_content = mail.content;
        mail.content = HtmlSimplifier.simplify(mail.content);
    } else {
        mail.content = ""; // 그외 무시
    }
    return mail;
}


/**
 * 복합 재귀 구조 메일 본문 일렬화
 * @param mails 복합 재귀 구조의 메일 집합
 * @param list  일렬화하여 담을 배열
 * @returns {*}
 */
function serializeContent(mails, list) {
    "use strict";
    mails.forEach((mail) => {
        if (mail["content-type"].type.match(/multipart\//i)) { // 내재 메일이 다시 복합 구조일 경우 재귀 호출
            serializeContent(mail.content, list);
        } else if (mail["content-type"].type.match(/text/i)) { // 일반 문자열일 경우 배열에 추가
            list.push(mail);
        }
        // 그외의 타입은 무시 (PDF 등)
    });
    return list;
}


//can think about OOP bot