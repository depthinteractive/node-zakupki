import React from 'react';
import { getCustomerStory } from '../API/CustomerStory';

import { CircularProgress, Typography, Container, Grid, Link } from '@material-ui/core';
import MaterialTable from 'material-table';

export default class CustomerStory extends React.Component {

    state = {
        data: null
    }

    async componentDidMount() {
        this.setState({
            data: await getCustomerStory(this.props.inn)
        })
    }

    formatPrice(number) {
        return number ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(number) : '-';
    }

    render() {
        const { data } = this.state;

        if (data === null) {
            return <CircularProgress />
        }

        console.log(data);

        const purchases = data.purchases;
        const customer = purchases[0].meta['Заказчик'];

        return (
            <Container fixed>
                <Typography variant="h5">{customer['Название']}</Typography>
                <Typography variant="subtitle2">ИНН: {customer['ИНН']}</Typography>

                <Grid container spacing={4}>
                    {purchases.map( (purchase, i) => {
                        const nmc = purchase.meta["Закупка"]["НМЦ"];

                        // add info to winners table
                        purchase.winners && purchase.winners.forEach( (winner, i, all) => {
                            if (winner.win_price) {
                                winner.nmcDiff = nmc - winner.win_price;

                                const next = all[i+1];
                                if (next && next.win_price) {
                                    winner.nextDiff = next.win_price - winner.win_price;
                                }
                            }
                        })

                        return (
                            <Grid item xs={12} container key={i}>
                                <Grid item xs={12} container justify="space-between">
                                    <Grid item>
                                        <Typography variant="subtitle1">
                                            <Link href={purchase.meta["Закупка"]["Номер_Ссылка"]} target="_blank">{purchase.meta["Закупка"]["Номер"]}</Link>
                                            &nbsp;от {new Date(purchase.meta["Закупка"]["Дата публикации"]).toLocaleString()}
                                        </Typography>
                                    </Grid>
                                    <Grid item>
                                        <Typography variant="subtitle1" color="secondary">НМЦ: {this.formatPrice(nmc)}</Typography>
                                    </Grid>
                                    <Grid item>
                                        {purchase.meta["Закупка"]["Этап отбора"]}
                                    </Grid>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="body1">{purchase.meta["Закупка"]["Название"]}</Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <MaterialTable
                                        columns={[
                                            {
                                                field: 'winner',
                                                title: 'Победитель'
                                            },
                                            {
                                                title: 'Цена',
                                                render: rowData => this.formatPrice(rowData.win_price)
                                            },
                                            {
                                                title: 'Разница с НМЦ',
                                                render: rowData => this.formatPrice(rowData.nmcDiff)
                                            },
                                            {
                                                title: 'Разница со следующим',
                                                render: rowData => this.formatPrice(rowData.nextDiff)
                                            }
                                        ]}
                                        data={purchase.winners}
                                        options={{
                                            paging: false,
                                            search: false,
                                            toolbar: false,
                                            rowStyle: (rowData, line) => {
                                                if (line === 0) {
                                                    return {
                                                        backgroundColor: 'cyan'
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        )
                    })}
                </Grid>
            </Container>
        )
    }
}