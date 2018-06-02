"use strict";

var Wish = function (text) {
    if (text) {
        var o = JSON.parse(text);
        this.from = o.from;
        this.name = o.name;
        this.target = o.target;
        this.deposite = o.deposite;
        this.idx = o.idx;
        this.tag = o.tag;
    }
};

Wish.prototype = {
    toString: function () {
        return JSON.stringify(this);
    }
};

var WishList = function () {
    LocalContractStorage.defineMapProperty(this, "wishMap", {
        parse: function (text) {
            return new Wish(text);
        },
        stringify: function (o) {
            return o.toString();
        }
    });
    LocalContractStorage.defineProperty(this, "wishCounter");
    LocalContractStorage.defineProperty(this, "ownerAddress");

};

WishList.prototype = {
    init: function () {
        this.wishCounter = 0;
        this.ownerAddress = Blockchain.transaction.from;
    },
    _getNextWishCounter: function () {
        return this.wishCounter + 1;
    },
    getWishCounter: function () {
        return this.wishCounter;
    },
    _toBigNumber: function (value) {
        return new BigNumber(value);
    },

    _nasToWei: function (value) {
        return this._toBigNumber(value).times(this._toBigNumber(10).pow(18));
    },
    //存钱
    save: function (idx) {
        var from = Blockchain.transaction.from;
        var value = Blockchain.transaction.value;
        //
        var wish = this.wishMap.get(idx);
        if (!wish) {
            throw Error('This wish doesnt exist')
        }
        var money = this._toBigNumber(wish.deposite);
        var target = this._toBigNumber(wish.target);
        var newDeposite = money.plus(value);
        wish.deposite = newDeposite;

        // 达到心愿，退还
        if (!newDeposite.lt(target)) {
            wish.tag = 1;
            var result = Blockchain.transfer(from, newDeposite);
            if (!result) {
                throw new Error("transfer failed.");
            }
        }
        this.wishMap.put(idx, wish);
        return 'success';
    },
    // 许下心愿
    makeAWish: function (name, target) {
        var from = Blockchain.transaction.from;
        var nas = this._nasToWei(target);
        var wish = new Wish();
        wish.from = from;
        wish.name = name;
        wish.target = nas;
        wish.deposite = this._toBigNumber(0);
        wish.idx = this.wishCounter;
        this.wishCounter = this._getNextWishCounter();
        wish.tag = 0;
        this.wishMap.set(wish.idx, wish);
        return 'success';
    },
    cancelAWish: function (idx) {
        var from = Blockchain.transaction.from;

        var wish = this.wishMap.get(idx);
        if (!wish) {
            throw Error('This wish doesnt exist')
        }
        if (wish.tag != 0) {
            throw Error('This wish has ended')
        }
        var money = this._toBigNumber(wish.deposite);
        // 合约作者抽取5%
        var fee = money.times(0.05);
        Blockchain.transfer(this.ownerAddress, fee);
        var newDeposite = money.minus(fee);

        var result = Blockchain.transfer(from, newDeposite);
        if (!result) {
            throw new Error("transfer failed.");
        }

        wish.tag = -1;
        wish.deposite = 0;
        this.wishMap.put(idx, wish);
        return JSON.stringify({
            fee: fee,
            refund: newDeposite
        });
        // return "success";
    },
    getAll: function () {
        var list = [];
        for (var i = 0; i < this.wishCounter; i++) {
            list.push(this.wishMap.get(i));
        }
        return list;
    },
    getMine: function () {
        var from = Blockchain.transaction.from;
        var list = [];
        for (var i = 0; i < this.wishCounter; i++) {
            var item = this.wishMap.get(i);
            if (item.from == from) {
                item.target = this._convertBigNumber(item.target);
                item.deposite = this._convertBigNumber(item.deposite);
                list.push(item);
            }
        }
        return list;
    },
    _convertBigNumber:function(_num){
        var num = Number(_num);
        return (num/Number("1000000000000000000")).toFixed(3);
    },
};

module.exports = WishList;