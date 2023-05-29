import {Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn} from 'typeorm';
import {BaseEntity} from "../../common/base.entity";

@Entity('validators_history')
export class ValidatorHistoryEntity extends BaseEntity<ValidatorHistoryEntity> {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'varchar', length: 128, nullable: true})
    extra: string;

    @Column({type: 'int'})
    validator_id: number;

    @Column({type: 'int'})
    block_number: number;

    @CreateDateColumn({name: 'created_at', type: 'timestamp'})
    createdAt: Date;

    @UpdateDateColumn({name: 'updated_at', type: 'timestamp'})
    updatedAt: Date;

}
