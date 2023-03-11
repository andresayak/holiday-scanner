import {Entity, Column, PrimaryGeneratedColumn} from 'typeorm';
import {BaseEntity} from "../../common/base.entity";
import {BigNumber} from "ethers";

@Entity('pairs')
export class PairEntity extends BaseEntity<PairEntity> {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'varchar', length: 42, unique: true})
    address: string;

    @Column({type: 'varchar', length: 42, nullable: true})
    factory: string;

    @Column({type: 'varchar', length: 42, nullable: true})
    token0: string;

    @Column({type: 'varchar', length: 42, nullable: true})
    token1: string;

    @Column({type: 'varchar', length: 42, nullable: true})
    reserve0: BigNumber;

    @Column({type: 'varchar', length: 42, nullable: true})
    reserve1: BigNumber;

    @Column({type: 'integer', nullable: true})
    blockNumber: number;

    @Column({type: 'integer', nullable: true})
    transactionIndex: number;

    @Column({type: 'integer', nullable: true})
    logIndex: number;
}
