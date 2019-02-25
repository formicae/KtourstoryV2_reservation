class Mail {
    constructor(raw) {
        this.messageid = raw.messageid;
        this.date = raw.date;
        this.from = raw.from;
        this.fromname = raw.fromname;
        this.fromaddress = raw.fromaddress;
        this.subject = raw.subject;
        this.to = raw.to;
        this["content-type"] = raw["content-type"];
        this["content-transfer-encoding"] = raw["content-transfer-encoding"];
        this.content = raw.content;
    }
}

// const sample = {
//     "messageid": "15da1a51245c12a2d",
//     "date": "Wed, 9 Aug 2017 00:00:01 +0900",
//     "from": "sample from <from@sample.com>",
//     "fromname": "sample from",
//     "fromaddress": "from@sample.com",
//     "subject": "sample subject",
//     "to": "to@sample.com",
//     "content-type": {
//         "type": "text/plain",
//         "charset": "utf-8"
//     },
//     "content-transfer-encoding": "base64",
//     "content": "sample content",
// }