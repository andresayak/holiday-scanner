import {Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn} from 'typeorm';
import {BaseEntity} from "../../common/base.entity";

@Entity('peers_active')
export class PeerActiveEntity extends BaseEntity<PeerActiveEntity> {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'int'})
    peer_id: number;

    @CreateDateColumn({name: 'created_at', type: 'timestamp'})
    createdAt: Date;
}
