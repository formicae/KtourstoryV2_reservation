const Bus = require('./bus');
const SCORE_TABLE = {
    'STRATEGY_1' : {
        'description':'nationality first',
        'criteria' : {
            'PICKUP_PLACE':-4,
            'NATIONALITY':-6,
            'LANGUAGE':-5,
            'NUM_BUS':-10,
            'ADD_PEOPLE':1,
            'ALL_PEOPLE':1,
            'COST_INCREASE':-5,
            'COST_DECREASE':5
        }
    },
    'STRATEGY_2' : {
        'description':'minimum bus first',
        'criteria' : {
            'PICKUP_PLACE':-6,
            'NATIONALITY':-5,
            'LANGUAGE':-4,
            'NUM_BUS':-12,
            'ADD_PEOPLE':1,
            'ALL_PEOPLE':1,
            'COST_INCREASE':-7,
            'COST_DECREASE':7
        }
    }
};
class ScoreTable {
    constructor(reservation) {
        this.totalBusNumber = 1;
        this.totalTeamNumber = 1;
        this.totalScore = 0;
        this.teams = {
            'BUS_1' : ScoreTable.newTeam(this.totalTeamNumber)
        };
        this.name = reservation.name;
        this.product_id = reservation.product_id;
        this.operation_date = reservation.operation_date;
        this.timezone = (!reservation.timezone) ? 'UTC+9' : reservation.timezone;
        this.rebuildCount = 0;
        this.isModifiable = true;
    }
    static newTeam(teamNumber) {
        return {
            numPeople: 0,
            teamNumber : teamNumber,
            teamScore : 0,
            numLanguages : 0,
            reservationIds : [],
            busCost : 0,
            busId : undefined,
            memo : '',
            message : '',
            cash : {
                income : 0.00,
                expenditure : 0.00
            },
            guide : ''
        }
    }
    static selectBusSize(reservation) {
        const numPeople = Number(reservation.adult) + Number(reservation.child) + Number(reservation.infant);
        const tempArr = [];
        Bus.getSimpleData().then(busObj => {
            Object.keys(busObj).forEach(id => {
                tempArr.push({id:id,data:busObj[id]})
            };
            const newArr = tempArr.sort((a, b) => {
                if (a.data.max_people_number < b.data.max_people_number) return -1;
                if (a.data.cost < b.data.cost) return -1;
            });
            // todo : 정렬한 리스트 변수로 원하는 버스 id찾아내서 데이터와 함께 반환.
        })
    }
    static validCheck(scoreTable) {
        scoreTable.isModifiable = (scoreTable.operation_date < new Date());
        return scoreTable;
    }
    static scoreManager(scoreTable, reservation) {
        const numPeople = Number(reservation.adult) + Number(reservation.child) + Number(reservation.infant);
        const previousTotalScore = scoreTable.totalScore;
        const possibleScores = {};
        const previousScores = {};
        Object.keys(scoreTable.teams).forEach(team => {
            previousScores[team] = scoreTable.teams.teamScore;
        });
        Object.keys(SCORE_TABLE).forEach(strategy => {
            possibleScores[strategy] = previousTotalScore;
            Object.keys(scoreTable.teams).forEach(team => {
                if (scoreTable.teams[team].numPeople + numPeople < )
            })

        })
    }

    static rebuilder(){

    }
}