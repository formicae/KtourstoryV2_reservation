class Operation {
    constructor(data){
        this.data = data;
    }
    static generateElastic(data) {
        const tempObj = {
            id : data.id,
            product_name : data.product_name,
            product_alias : data.product_alias,
            date : data.date,
            area : data.area,
            total : data.total,
            teams : {}
        }
        if (!!data.teams) {
            if (data.teams.__proto__ === new Map().__proto__) {
                for (let i of data.teams) {
                    let id = i[0];
                    let teamData = i[1];
                    tempObj.teams[id] = {
                        id : teamData.id,
                        notification : teamData.notification,
                        guides : teamData.guides,
                        reservations : {}
                    };
                    if (!!data.teams[id].reservations) {
                        for (let k of data.teams[id].reservations) {
                            let reservation_id = k[0];
                            let reservationData = k[1];
                            tempObj.teams[id].reservations[reservation_id] = reservationData;
                        }
                    }
                }
                return tempObj;
            } else {
                if (!!data.teams && data.teams.__proto__ === {}.__proto__){
                    tempObj.teams = data.teams;
                }
                return tempObj;
            }
        }
    }
}

module.exports = Operation;