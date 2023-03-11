import {Entity, Column, PrimaryGeneratedColumn} from 'typeorm';
import {BaseEntity} from "../../common/base.entity";

@Entity('tokens')
export class TokenEntity extends BaseEntity<TokenEntity> {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'varchar', length: 42, unique: true})
    address: string;
}
