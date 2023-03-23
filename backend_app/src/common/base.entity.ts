import {classToPlain, Exclude} from "class-transformer";
import {DeepPartial} from "typeorm";
import {ObjectLiteral} from "typeorm/common/ObjectLiteral";

export abstract class BaseEntity<T extends ObjectLiteral> {
    static provider: string;

    constructor(partial: DeepPartial<T>) {
        this.fill(partial);
    }

    @Exclude()
    readonly context: any;

    fill(partial: any) {
        Object.assign(this, partial);
        return this;
    }

    toJSON() {
        let json = classToPlain(this);
        Object.entries(json).map(([col, value]) => {
            let result = col.match(/^__(.*)__$/);
            if (result) {
                json[result[1]] = value;
                delete json[result[0]];
            }
        })
        return json;
    }
}
