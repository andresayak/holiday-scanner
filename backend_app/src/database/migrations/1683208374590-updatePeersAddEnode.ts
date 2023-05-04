import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class updatePeersAddEnode1683208374590 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('peers', [
            new TableColumn({
                name: 'enode',
                type: 'text',
                isNullable: true,
            }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
