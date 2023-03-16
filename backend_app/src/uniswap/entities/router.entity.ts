import {Entity, Column, PrimaryGeneratedColumn} from 'typeorm';
import {BaseEntity} from "../../common/base.entity";

@Entity('router')
export class RouterEntity extends BaseEntity<RouterEntity> {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'varchar', length: 66})
    address: string;

    @Column({type: 'varchar', length: 66, nullable: true})
    weth: string;

    @Column({type: 'varchar', length: 66, nullable: true})
    factory: string;

    @Column({type: 'varchar', length: 66})
    network: string;

}
